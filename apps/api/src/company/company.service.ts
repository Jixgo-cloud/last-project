import { BadRequestException, ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { VerificationDocumentsDto } from './dto/company-profile.dto';
import { validateVerificationDocuments, streamVerificationDocument } from './verification-documents';
import { PrismaService } from '../prisma/prisma.service';
import { CandidateService } from '../candidate/candidate.service';
import {
  assessmentQuestionsMatch,
  getAssessmentValidationError,
  VerificationStatus,
  ApplicationStatus,
  NotificationType,
} from '@smartcareer/shared';
import { NotificationsService } from '../notifications/notifications.service';

// Pipeline/profile views need results, not question snapshots or submitted code.
const attemptSummarySelect = {
  id: true,
  assessmentId: true,
  status: true,
  score: true,
  maxScore: true,
  percentage: true,
  passed: true,
  humanScore: true,
  finalScore: true,
  reviewStatus: true,
  startedAt: true,
  completedAt: true,
  integrityEvents: true,
  assessment: {
    select: { id: true, title: true, passingScore: true, type: true, companyId: true },
  },
} as const;

@Injectable()
export class CompanyService {
  constructor(
    private prisma: PrismaService,
    private candidateService: CandidateService,
    private notificationsService: NotificationsService,
  ) {}

  async getCompanyByUserId(userId: string) {
    const member = await this.prisma.companyMember.findFirst({
      where: { userId },
      include: {
        company: {
          include: {
            verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
            jobs: {
              include: {
                skills: { include: { skill: true } },
                _count: { select: { applications: true } },
                applications: {
                  where: { status: ApplicationStatus.ACCEPTED },
                  select: { id: true },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!member || !member.company) {
      throw new NotFoundException('Company not found for this user');
    }

    return member.company;
  }

  async updateProfile(userId: string, data: any) {
    const company = await this.getCompanyByUserId(userId);

    const updated = await this.prisma.company.update({
      where: { id: company.id },
      data: {
        name: data.name ?? company.name,
        description: data.description,
        website: data.website,
        address: data.address,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        logoUrl: data.logoUrl,
      },
    });

    // Sync updated logo to company's jobs if logoUrl was provided
    if (data.logoUrl !== undefined) {
      await this.prisma.job.updateMany({
        where: { companyId: company.id },
        data: { companyLogoUrl: data.logoUrl },
      });
    }

    return updated;
  }

  async getProfile(userId: string) {
    const company = await this.getCompanyByUserId(userId);
    return { ...company, verifications: company.verifications.map(verification => {
      const documents = verification.documents as any;
      const files = Array.isArray(documents?.files) ? documents.files.map((file: any, index: number) => ({
        name: file.name, type: file.type, size: file.size,
        dataUrl: typeof file.dataUrl === 'string'
          ? `/api/company/verifications/${encodeURIComponent(verification.id)}/documents/${index}` : null,
      })) : [];
      return { ...verification, documents: { files } };
    }) };
  }

  async downloadVerificationDocument(userId: string, verificationId: string, index: number) {
    const company = await this.getCompanyByUserId(userId);
    const verification = await this.prisma.companyVerification.findFirst({
      where: { id: verificationId, companyId: company.id }, select: { documents: true },
    });
    if (!verification) throw new NotFoundException('ไม่พบเอกสารนี้');
    return streamVerificationDocument(verification.documents, index);
  }

  async submitVerification(userId: string, businessRegNo: string, documents: VerificationDocumentsDto) {
    const company = await this.getCompanyByUserId(userId);
    const validated = validateVerificationDocuments(documents);
    return this.prisma.$transaction(async tx => {
      // Serialize submissions and reviews for the same company across processes/tabs.
      await tx.$queryRaw`SELECT id FROM companies WHERE id = ${company.id} FOR UPDATE`;
      const current = await tx.company.findUniqueOrThrow({ where: { id: company.id } });
      if (current.verificationStatus === VerificationStatus.VERIFIED) {
        throw new ConflictException('บริษัทได้รับการยืนยันแล้ว ไม่ต้องส่งคำขอซ้ำ');
      }
      const pending = await tx.companyVerification.findFirst({ where: { companyId: company.id, status: VerificationStatus.PENDING } });
      if (pending) throw new ConflictException('ส่งคำขอแล้ว กรุณารอผู้ดูแลตรวจสอบ');
      const verification = await tx.companyVerification.create({
        data: { companyId: company.id, businessRegNo, documents: { ...validated, taxId: businessRegNo, submittedAt: new Date().toISOString() }, status: VerificationStatus.PENDING },
      });
      await tx.company.update({ where: { id: company.id }, data: { verificationStatus: VerificationStatus.PENDING } });
      return verification;
    });
  }

  private async validateJob(companyId: string, data: any, existing?: any) {
    const minimum = data.salaryMin !== undefined ? data.salaryMin : existing?.salaryMin;
    const maximum = data.salaryMax !== undefined ? data.salaryMax : existing?.salaryMax;
    if (minimum != null && maximum != null && Number(minimum) > Number(maximum)) {
      throw new BadRequestException('Minimum salary must not exceed maximum salary.');
    }
    if (data.customAssessmentId) {
      const assessment = await this.prisma.assessment.findFirst({
        where: { id: data.customAssessmentId, companyId, isActive: true },
        include: { questions: { include: { choices: true } } },
      });
      if (!assessment) throw new BadRequestException('กรุณาเลือกข้อสอบของบริษัทที่เปิดใช้งาน');
      const error = getAssessmentValidationError(assessment);
      if (error) throw new BadRequestException(`ข้อสอบยังไม่พร้อม: ${error}`);
    }
  }

  async createJob(userId: string, jobDto: any) {
    const company = await this.getCompanyByUserId(userId);
    await this.validateJob(company.id, jobDto);

    const slug =
      jobDto.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      Math.floor(1000 + Math.random() * 9000);

    const job = await this.prisma.job.create({
      data: {
        companyId: company.id,
        companyName: company.name,
        companyLogoUrl: company.logoUrl,
        title: jobDto.title,
        slug,
        description: jobDto.description,
        requirements: jobDto.requirements,
        benefits: jobDto.benefits,
        location: jobDto.location || 'Bangkok, Thailand',
        isRemote: jobDto.isRemote || false,
        employmentType: jobDto.employmentType || 'FULL_TIME',
        salaryMin: jobDto.salaryMin != null ? Number(jobDto.salaryMin) : null,
        salaryMax: jobDto.salaryMax != null ? Number(jobDto.salaryMax) : null,
        salaryCurrency: jobDto.salaryCurrency || 'THB',
        acceptedQuota: jobDto.acceptedQuota != null ? Number(jobDto.acceptedQuota) : null,
        source: 'INTERNAL',
        customAssessmentId: jobDto.customAssessmentId || null,
        skills: {
          create: (jobDto.skills || []).map((s: { skillId: string; isRequired?: boolean; minimumScore?: number }) => ({
            skillId: s.skillId,
            isRequired: s.isRequired !== false,
            minimumScore: s.minimumScore ?? 50,
          })),
        },
      },
      include: {
        skills: { include: { skill: true } },
      },
    });

    return job;
  }

  async updateJob(userId: string, jobId: string, jobDto: any) {
    const company = await this.getCompanyByUserId(userId);
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, companyId: company.id },
    });
    if (!job) throw new NotFoundException('Job not found or unauthorized');

    await this.validateJob(company.id, jobDto, job);
    const updateData: any = {};
    if (jobDto.title !== undefined) updateData.title = jobDto.title;
    if (jobDto.description !== undefined) updateData.description = jobDto.description;
    if (jobDto.requirements !== undefined) updateData.requirements = jobDto.requirements;
    if (jobDto.benefits !== undefined) updateData.benefits = jobDto.benefits;
    if (jobDto.location !== undefined) updateData.location = jobDto.location;
    if (jobDto.isRemote !== undefined) updateData.isRemote = jobDto.isRemote;
    if (jobDto.employmentType !== undefined) updateData.employmentType = jobDto.employmentType;
    if (jobDto.salaryMin !== undefined) updateData.salaryMin = jobDto.salaryMin != null ? Number(jobDto.salaryMin) : null;
    if (jobDto.salaryMax !== undefined) updateData.salaryMax = jobDto.salaryMax != null ? Number(jobDto.salaryMax) : null;
    if (jobDto.salaryCurrency !== undefined) updateData.salaryCurrency = jobDto.salaryCurrency;
    if (jobDto.acceptedQuota !== undefined) updateData.acceptedQuota = jobDto.acceptedQuota != null ? Number(jobDto.acceptedQuota) : null;
    if (jobDto.customAssessmentId !== undefined) updateData.customAssessmentId = jobDto.customAssessmentId || null;

    if (jobDto.skills && Array.isArray(jobDto.skills)) {
      updateData.skills = {
        create: jobDto.skills.map((s: { skillId: string; isRequired?: boolean; minimumScore?: number }) => ({
          skillId: s.skillId,
          isRequired: s.isRequired !== false,
          minimumScore: s.minimumScore ?? 50,
        })),
      };
    }

    return this.prisma.$transaction(async tx => {
      if (jobDto.skills) await tx.jobSkill.deleteMany({ where: { jobId } });
      return tx.job.update({
        where: { id: jobId }, data: updateData,
        include: { skills: { include: { skill: true } }, customAssessment: true },
      });
    });
  }

  async toggleJobStatus(userId: string, jobId: string) {
    const company = await this.getCompanyByUserId(userId);
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, companyId: company.id },
    });
    if (!job) throw new NotFoundException('Job not found or unauthorized');

    return this.prisma.job.update({
      where: { id: jobId },
      data: { isActive: !job.isActive },
    });
  }

  async deleteJob(userId: string, jobId: string) {
    const company = await this.getCompanyByUserId(userId);
    return this.prisma.$transaction(async tx => {
      // Lock the parent before checking children: concurrent FK inserts must
      // finish before this check, or wait until an empty job has been deleted.
      const jobs = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.jobs
        WHERE id = ${jobId} AND "companyId" = ${company.id}
        FOR UPDATE
      `;
      if (!jobs.length) throw new NotFoundException('Job not found or unauthorized');
      const applications = await tx.jobApplication.count({ where: { jobId } });
      if (applications > 0) {
        throw new BadRequestException('งานนี้มีประวัติใบสมัครแล้ว จึงลบไม่ได้ กรุณาปิดรับสมัครเพื่อรักษาประวัติของผู้สมัคร');
      }
      return tx.job.delete({ where: { id: jobId } });
    }, { isolationLevel: 'ReadCommitted' });
  }

  async getApplications(userId: string, jobId?: string) {
    const company = await this.getCompanyByUserId(userId);
    if (jobId && !await this.prisma.job.findFirst({ where: { id: jobId, companyId: company.id } })) {
      throw new NotFoundException("Job not found or unauthorized");
    }

    return this.prisma.jobApplication.findMany({
      where: {
        job: {
          companyId: company.id,
          ...(jobId ? { id: jobId } : {}),
        },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            customAssessmentId: true,
            customAssessment: {
              select: {
                id: true,
                title: true,
                passingScore: true,
                type: true,
                timeLimitMinutes: true,
              },
            },
          },
        },
        assignedAssessment: {
          select: {
            id: true,
            title: true,
            passingScore: true,
            type: true,
            timeLimitMinutes: true,
          },
        },
        candidate: {
          include: {
            user: { select: { email: true } },
            skills: { include: { skill: true } },
            githubRepos: { take: 3 },
            assessmentAttempts: {
              where: { assessment: { OR: [{ companyId: company.id }, { companyId: null }] } },
              orderBy: { startedAt: 'desc' },
              take: 5,
              select: attemptSummarySelect,
            },
          },
        },
        evaluation: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateApplicationStatus(
    userId: string,
    applicationId: string,
    newStatus: ApplicationStatus,
    note?: string,
    assessmentId?: string,
  ) {
    const company = await this.getCompanyByUserId(userId);

    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          include: { customAssessment: true },
        },
        candidate: true,
        assignedAssessment: true,
      },
    });

    if (!application || application.job.companyId !== company.id) {
      throw new ForbiddenException('Cannot update application for another company');
    }
    if (application.status === ApplicationStatus.CANCELLED) {
      throw new BadRequestException('ใบสมัครรอบนี้ถูกผู้สมัครยกเลิกแล้ว ไม่สามารถเปลี่ยนสถานะหรือมอบหมายข้อสอบได้');
    }

    let assignedAssessmentId = application.assignedAssessmentId;
    let assignedAssessmentObj: any = application.assignedAssessment;
    if (assessmentId) {
      const assess = await this.prisma.assessment.findFirst({
        where: {
          id: assessmentId,
          isActive: true,
          OR: [{ companyId: company.id }, { companyId: null }],
        },
        include: { questions: { include: { choices: true } } },
      });
      if (!assess) throw new BadRequestException("ข้อสอบที่เลือกปิดใช้งานหรือไม่มีสิทธิ์มอบหมาย");
      const readinessError = getAssessmentValidationError(assess);
      if (readinessError) throw new BadRequestException(`ข้อสอบยังไม่พร้อม: ${readinessError}`);
      if (assess) {
        assignedAssessmentId = assess.id;
        assignedAssessmentObj = assess;
      }
    }

    const previousStatus = application.status;

    const updated = await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        assignedAssessmentId: assignedAssessmentId || null,
        internalNote: note ? `${application.internalNote || ''}\n[${new Date().toISOString()}] ${note}` : application.internalNote,
        statusHistory: {
          create: {
            previousStatus,
            newStatus,
            changedById: userId,
            note: note || (newStatus === ApplicationStatus.TECHNICAL_TEST && assignedAssessmentObj
              ? `Status updated to TECHNICAL_TEST with assessment "${assignedAssessmentObj.title}"`
              : `Status updated to ${newStatus}`),
          },
        },
      },
      include: {
        job: {
          include: { customAssessment: true },
        },
        assignedAssessment: true,
        statusHistory: true,
      },
    });

    // Notify Candidate about application status update
    try {
      const candidateUserId = application.candidate?.userId;
      if (candidateUserId) {
        const effectiveAssessment = assignedAssessmentObj || application.job?.customAssessment;
        const testName = effectiveAssessment?.title ? ` "${effectiveAssessment.title}"` : '';

        const statusNotifMap: Record<ApplicationStatus, { title: string; message: string; type?: NotificationType }> = {
          [ApplicationStatus.INTERVIEW]: {
            title: 'นัดหมายสัมภาษณ์งาน',
            message: `บริษัท ${company.name} ได้นัดหมายสัมภาษณ์งานสำหรับตำแหน่ง "${application.job.title}"`,
          },
          [ApplicationStatus.OFFER]: {
            title: '🎉 ได้รับข้อเสนองาน (Job Offer)',
            message: `ยินดีด้วย! บริษัท ${company.name} ได้ยื่นข้อเสนองานตำแหน่ง "${application.job.title}" ให้กับคุณ`,
          },
          [ApplicationStatus.TECHNICAL_TEST]: {
            title: 'มอบหมายแบบทดสอบทักษะ (Skill Assessment)',
            message: `บริษัท ${company.name} เชิญให้คุณทำแบบทดสอบทักษะ${testName} สำหรับตำแหน่ง "${application.job.title}"`,
            type: NotificationType.ASSESSMENT_ASSIGNED,
          },
          [ApplicationStatus.ACCEPTED]: {
            title: '✅ ยืนยันการตอบรับเข้าทำงาน (Accepted)',
            message: `บริษัท ${company.name} ได้ยืนยันการรับคุณเข้าทำงานตำแหน่ง "${application.job.title}" เรียบร้อยแล้ว`,
          },
          [ApplicationStatus.REJECTED]: {
            title: 'อัปเดตผลการพิจารณาใบสมัคร',
            message: `บริษัท ${company.name} ได้แจ้งผลการพิจารณาสำหรับตำแหน่ง "${application.job.title}"`,
          },
          [ApplicationStatus.REVIEWING]: {
            title: 'ใบสมัครกำลังอยู่ระหว่างพิจารณา',
            message: `บริษัท ${company.name} กำลังตรวจสอบประวัติของคุณสำหรับตำแหน่ง "${application.job.title}"`,
          },
          [ApplicationStatus.APPLIED]: {
            title: 'อัปเดตสถานะใบสมัครงาน',
            message: `สถานะใบสมัครงานตำแหน่ง "${application.job.title}" ถูกปรับเป็น ยื่นใบสมัครแล้ว`,
          },
          [ApplicationStatus.CANCELLED]: {
            title: 'ยกเลิกใบสมัครงาน',
            message: `ใบสมัครงานตำแหน่ง "${application.job.title}" ได้ถูกยกเลิกแล้ว`,
          },
        };

        const notifPayload = statusNotifMap[newStatus] || {
          title: 'อัปเดตสถานะการสมัครงาน',
          message: `ใบสมัครงานตำแหน่ง "${application.job.title}" ได้รับการปรับสถานะเป็น ${newStatus}`,
        };

        const notifLink = newStatus === ApplicationStatus.TECHNICAL_TEST && effectiveAssessment?.id
          ? `/assessments/${effectiveAssessment.id}`
          : '/applications';

        await this.notificationsService.createNotification(candidateUserId, {
          type: notifPayload.type || NotificationType.APPLICATION_STATUS_CHANGED,
          title: notifPayload.title,
          message: notifPayload.message,
          link: notifLink,
          metadata: {
            applicationId: application.id,
            jobId: application.jobId,
            jobTitle: application.job.title,
            companyId: company.id,
            companyName: company.name,
            assessmentId: effectiveAssessment?.id || null,
            assessmentTitle: effectiveAssessment?.title || null,
            previousStatus,
            newStatus,
            note: note || null,
          },
        });
      }
    } catch (notifErr) {
      console.error('Failed to dispatch candidate status notification:', notifErr);
    }

    // GAP-COM-01 (TC-COM-05): Job Quota Auto-Close
    // If the application is marked as ACCEPTED and job has an acceptedQuota,
    // verify whether the quota has been met and auto-close the job.
    if (newStatus === ApplicationStatus.ACCEPTED && application.jobId) {
      const job = await this.prisma.job.findUnique({
        where: { id: application.jobId },
      });

      if (job && job.acceptedQuota && job.acceptedQuota > 0 && job.isActive) {
        const acceptedCount = await this.prisma.jobApplication.count({
          where: {
            jobId: application.jobId,
            status: ApplicationStatus.ACCEPTED,
          },
        });

        if (acceptedCount >= job.acceptedQuota) {
          await this.prisma.job.update({
            where: { id: application.jobId },
            data: { isActive: false },
          });
        }
      }
    }

    return updated;
  }

  async assignAssessmentToApplication(
    userId: string,
    applicationId: string,
    assessmentId: string,
    note?: string,
  ) {
    return this.updateApplicationStatus(
      userId,
      applicationId,
      ApplicationStatus.TECHNICAL_TEST,
      note || 'Assigned skill assessment test',
      assessmentId,
    );
  }

  // GAP-COM-02 (TC-COM-13): Applicant Batch Data Export (CSV Export)
  async exportApplicationsCsv(userId: string, jobId?: string): Promise<string> {
    const applications = await this.getApplications(userId, jobId);

    const headers = [
      'Application ID',
      'Candidate Name',
      'Email',
      'Target Career',
      'GitHub Username',
      'Job Title',
      'Status',
      'Match Score (%)',
      'Applied Date',
      'Internal Note',
      'Eval Technical (1-5)',
      'Eval Problem Solving (1-5)',
      'Eval Communication (1-5)',
      'Eval Teamwork (1-5)',
      'Overall Feedback',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = applications.map((app) =>
      [
        escapeCsv(app.id),
        escapeCsv(app.candidate?.fullName || 'N/A'),
        escapeCsv(app.candidate?.user?.email || 'N/A'),
        escapeCsv(app.candidate?.targetCareer || 'N/A'),
        escapeCsv(app.candidate?.githubUsername || 'N/A'),
        escapeCsv(app.job?.title || 'N/A'),
        escapeCsv(app.status),
        escapeCsv(
          app.matchScoreAtApplication !== null && app.matchScoreAtApplication !== undefined
            ? Math.round(app.matchScoreAtApplication)
            : 'N/A',
        ),
        escapeCsv(new Date(app.createdAt).toISOString()),
        escapeCsv(app.internalNote || ''),
        escapeCsv(app.evaluation?.technicalScore ?? ''),
        escapeCsv(app.evaluation?.problemSolvingScore ?? ''),
        escapeCsv(app.evaluation?.communicationScore ?? ''),
        escapeCsv(app.evaluation?.teamworkScore ?? ''),
        escapeCsv(app.evaluation?.overallFeedback || ''),
      ].join(','),
    );

    // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility with Thai characters
    return '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');
  }

  // --- Company Custom Assessments ---
  async listCompanyAssessments(userId: string) {
    const company = await this.getCompanyByUserId(userId);

    const assessments = await this.prisma.assessment.findMany({
      where: { companyId: company.id },
      include: {
        skill: true,
        questions: { include: { choices: true } },
        _count: { select: { questions: true, attempts: true, jobs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return assessments.map(({ questions, ...assessment }) => {
      const readinessError = getAssessmentValidationError({ ...assessment, questions });
      return { ...assessment, isReady: !readinessError, readinessError };
    });
  }

  async getCompanyAssessmentDetail(userId: string, id: string) {
    const company = await this.getCompanyByUserId(userId);
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        skill: true,
        questions: {
          include: {
            choices: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!assessment || assessment.companyId !== company.id) {
      throw new ForbiddenException('You are not authorized to view this assessment');
    }
    return assessment;
  }

  async createCompanyAssessment(userId: string, data: any) {
    const company = await this.getCompanyByUserId(userId);
    const validationError = getAssessmentValidationError({
      title: data.title,
      type: data.type || 'PRACTICAL_CODING',
      timeLimitMinutes: data.timeLimitMinutes ?? 30,
      passingScore: data.passingScore ?? 70,
      questions: data.questions,
    });
    if (validationError) throw new BadRequestException(validationError);

    const cleanSlugPart = (data.title || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const slug =
      data.slug ||
      (cleanSlugPart
        ? `${cleanSlugPart}-${randomSuffix}`
        : `company-assessment-${(data.type || 'coding').toLowerCase()}-${randomSuffix}`);

    return this.prisma.assessment.create({
      data: {
        companyId: company.id,
        title: data.title,
        slug,
        description: data.description,
        type: data.type || 'PRACTICAL_CODING',
        skillId: data.skillId || null,
        timeLimitMinutes: data.timeLimitMinutes ? parseInt(data.timeLimitMinutes) : 30,
        passingScore: data.passingScore != null ? Number(data.passingScore) : 70,
        feedbackVisibility: data.feedbackVisibility || 'IMMEDIATE',
        isActive: data.isActive !== false,
        version: 1,
        questions: {
          create: (data.questions || []).map((q: any) => ({
            title: q.title || 'โจทย์ข้อสอบ',
            prompt: q.prompt || '',
            difficulty: q.difficulty || 'MEDIUM',
            points: q.points ? parseInt(q.points) : 50,
            starterCode: q.starterCode || null,
            testCases: q.testCases || null,
            evaluationMethod: q.evaluationMethod || 'AUTOMATED_TEST_CASES',
            rubric: q.rubric || null,
            solutionCode: q.solutionCode || null,
            explanation: q.explanation || null,
            version: 1,
            choices: {
              create: (q.choices || []).map((c: any, cIdx: number) => ({
                text: c.text,
                isCorrect: !!c.isCorrect,
                order: c.order !== undefined ? c.order : cIdx + 1,
              })),
            },
          })),
        },
      },
      include: {
        skill: true,
        questions: { include: { choices: true } },
      },
    });
  }

  async updateCompanyAssessment(userId: string, id: string, data: any) {
    const company = await this.getCompanyByUserId(userId);
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: { questions: { include: { choices: { orderBy: { order: 'asc' } } } } },
    });
    if (!assessment || assessment.companyId !== company.id) {
      throw new ForbiddenException('You are not authorized to edit this assessment');
    }

    const validationError = getAssessmentValidationError({
      title: data.title ?? assessment.title,
      type: data.type ?? assessment.type,
      timeLimitMinutes: data.timeLimitMinutes ?? assessment.timeLimitMinutes,
      passingScore: data.passingScore ?? assessment.passingScore,
      questions: data.questions ?? assessment.questions,
    });
    if (validationError) throw new BadRequestException(validationError);

    const metadataUpdate = {
      title: data.title ?? assessment.title,
      description: data.description ?? assessment.description,
      type: data.type ?? assessment.type,
      timeLimitMinutes: data.timeLimitMinutes !== undefined ? parseInt(data.timeLimitMinutes) : assessment.timeLimitMinutes,
      passingScore: data.passingScore !== undefined ? parseFloat(data.passingScore) : assessment.passingScore,
      feedbackVisibility: data.feedbackVisibility ?? assessment.feedbackVisibility,
      skillId: data.skillId !== undefined ? data.skillId : assessment.skillId,
      isActive: data.isActive !== undefined ? data.isActive : assessment.isActive,
      version: { increment: 1 },
    };

    return this.prisma.$transaction(async (tx) => {
      const attemptCount = await tx.assessmentAttempt.count({ where: { assessmentId: id } });
      const scoringSettingsChanged =
        (data.type !== undefined && data.type !== assessment.type) ||
        (data.timeLimitMinutes !== undefined && Number(data.timeLimitMinutes) !== assessment.timeLimitMinutes) ||
        (data.passingScore !== undefined && Number(data.passingScore) !== assessment.passingScore);
      if (attemptCount > 0 && scoringSettingsChanged) {
        throw new BadRequestException(
          'แบบทดสอบนี้มีผู้สมัครเริ่มทำแล้ว จึงแก้ประเภท เวลา หรือคะแนนผ่านไม่ได้ กรุณาสร้างชุดใหม่เพื่อรักษาผลเดิม',
        );
      }

      // 1. Update questions if provided in payload
      if (Array.isArray(data.questions)) {
        if (attemptCount > 0) {
          if (!assessmentQuestionsMatch(assessment.questions, data.questions)) {
            throw new BadRequestException(
              'แบบทดสอบนี้มีผู้สมัครเริ่มทำแล้ว จึงแก้โจทย์หรือตัวเลือกไม่ได้ กรุณาสร้างชุดใหม่เพื่อรักษาผลเดิม',
            );
          }
          return tx.assessment.update({
            where: { id },
            data: metadataUpdate,
            include: { skill: true, questions: { include: { choices: true } } },
          });
        }

        if (attemptCount === 0) {
          // No attempts yet: safely recreate all questions & choices
          await tx.question.deleteMany({ where: { assessmentId: id } });
          for (const q of data.questions) {
            await tx.question.create({
              data: {
                assessmentId: id,
                title: q.title || 'โจทย์ข้อสอบ',
                prompt: q.prompt || '',
                difficulty: q.difficulty || 'MEDIUM',
                points: q.points ? parseInt(q.points) : 50,
                starterCode: q.starterCode || null,
                testCases: q.testCases || null,
                evaluationMethod: q.evaluationMethod || 'AUTOMATED_TEST_CASES',
                rubric: q.rubric || null,
                solutionCode: q.solutionCode || null,
                explanation: q.explanation || null,
                version: 1,
                choices: {
                  create: (q.choices || []).map((c: any, cIdx: number) => ({
                    text: c.text,
                    isCorrect: !!c.isCorrect,
                    order: c.order !== undefined ? c.order : cIdx + 1,
                  })),
                },
              },
            });
          }
        } else {
          // Existing attempts: preserve relation integrity and update in-place
          for (const q of data.questions) {
            if (q.id) {
              await tx.question.update({
                where: { id: q.id },
                data: {
                  title: q.title || 'โจทย์ข้อสอบ',
                  prompt: q.prompt || '',
                  difficulty: q.difficulty || 'MEDIUM',
                  points: q.points ? parseInt(q.points) : 50,
                  starterCode: q.starterCode || null,
                  testCases: q.testCases || null,
                  evaluationMethod: q.evaluationMethod || 'AUTOMATED_TEST_CASES',
                  rubric: q.rubric || null,
                  solutionCode: q.solutionCode || null,
                  explanation: q.explanation || null,
                  version: { increment: 1 },
                },
              });

              if (Array.isArray(q.choices)) {
                // In-place update / upsert choices to preserve historical attempt references
                const existingChoices = await tx.choice.findMany({ where: { questionId: q.id } });
                const keepIds = q.choices.map((c: any) => c.id).filter(Boolean);
                const choicesToDelete = existingChoices.filter((ec) => !keepIds.includes(ec.id));
                for (const c of choicesToDelete) {
                  const answerCount = await tx.assessmentAnswer.count({ where: { selectedChoiceId: c.id } });
                  if (answerCount === 0) {
                    await tx.choice.delete({ where: { id: c.id } });
                  }
                }

                for (let cIdx = 0; cIdx < q.choices.length; cIdx++) {
                  const c = q.choices[cIdx];
                  if (c.id && existingChoices.some((ec) => ec.id === c.id)) {
                    await tx.choice.update({
                      where: { id: c.id },
                      data: {
                        text: c.text,
                        isCorrect: !!c.isCorrect,
                        order: c.order !== undefined ? c.order : cIdx + 1,
                      },
                    });
                  } else {
                    await tx.choice.create({
                      data: {
                        questionId: q.id,
                        text: c.text,
                        isCorrect: !!c.isCorrect,
                        order: c.order !== undefined ? c.order : cIdx + 1,
                      },
                    });
                  }
                }
              }
            } else {
              // Newly added question
              await tx.question.create({
                data: {
                  assessmentId: id,
                  title: q.title || 'โจทย์ข้อสอบ',
                  prompt: q.prompt || '',
                  difficulty: q.difficulty || 'MEDIUM',
                  points: q.points ? parseInt(q.points) : 50,
                  starterCode: q.starterCode || null,
                  testCases: q.testCases || null,
                  evaluationMethod: q.evaluationMethod || 'AUTOMATED_TEST_CASES',
                  rubric: q.rubric || null,
                  solutionCode: q.solutionCode || null,
                  explanation: q.explanation || null,
                  version: 1,
                  choices: {
                    create: (q.choices || []).map((c: any, cIdx: number) => ({
                      text: c.text,
                      isCorrect: !!c.isCorrect,
                      order: c.order !== undefined ? c.order : cIdx + 1,
                    })),
                  },
                },
              });
            }
          }
        }
      }

      // 2. Update Assessment metadata
      return tx.assessment.update({
        where: { id },
        data: metadataUpdate,
        include: {
          skill: true,
          questions: { include: { choices: true } },
        },
      });
    });
  }

  async toggleCompanyAssessment(userId: string, id: string) {
    const company = await this.getCompanyByUserId(userId);
    const assessment = await this.prisma.assessment.findUnique({ where: { id }, include: { questions: { include: { choices: true } } } });
    if (!assessment || assessment.companyId !== company.id) {
      throw new ForbiddenException('You are not authorized to toggle this assessment');
    }

    if (!assessment.isActive) {
      const error = getAssessmentValidationError(assessment);
      if (error) throw new BadRequestException(`ข้อสอบยังไม่พร้อม: ${error}`);
    }
    return this.prisma.assessment.update({
      where: { id },
      data: { isActive: !assessment.isActive },
    });
  }

  async deleteCompanyAssessment(userId: string, id: string) {
    const company = await this.getCompanyByUserId(userId);
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment || assessment.companyId !== company.id) {
      throw new ForbiddenException('You are not authorized to delete this assessment');
    }

    const attemptCount = await this.prisma.assessmentAttempt.count({ where: { assessmentId: id } });
    if (attemptCount > 0) {
      return this.prisma.assessment.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.assessment.delete({ where: { id } });
  }

  async listCompanyAssessmentAttempts(userId: string, assessmentId?: string) {
    const company = await this.getCompanyByUserId(userId);

    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: {
        assessment: {
          companyId: company.id,
          ...(assessmentId ? { id: assessmentId } : {}),
        },
      },
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            targetCareer: true,
            githubUsername: true,
          },
        },
        assessment: {
          select: {
            id: true,
            title: true,
            type: true,
            passingScore: true,
            feedbackVisibility: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    return attempts.map((att) => {
      const events: any[] = Array.isArray(att.integrityEvents) ? (att.integrityEvents as any[]) : [];
      const tabSwitchCount = events.filter(
        (e) => e.type === 'TAB_BLUR' || e.eventType === 'TAB_BLUR',
      ).length;
      const riskLevel: 'NORMAL' | 'REVIEW' = tabSwitchCount > 0 ? 'REVIEW' : 'NORMAL';

      return {
        ...att,
        integritySummary: {
          tabSwitchCount,
          riskLevel,
          events,
        },
      };
    });
  }

  async getCandidateProfile(userId: string, candidateId: string, applicationId?: string) {
    const company = await this.getCompanyByUserId(userId);

    // Verify authorization: Ensure candidate has applied to at least one job from this company
    const application = await this.prisma.jobApplication.findFirst({
      where: {
        ...(applicationId ? { id: applicationId } : {}),
        candidateId,
        job: { companyId: company.id },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            employmentType: true,
            customAssessmentId: true,
            customAssessment: {
              select: {
                id: true,
                title: true,
                passingScore: true,
                type: true,
              },
            },
          },
        },
        evaluation: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!application) {
      throw new ForbiddenException(
        'You can only view profiles of candidates who have applied to your company.',
      );
    }

    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
        skills: {
          include: {
            skill: true,
            evidences: {
              include: { repository: true },
            },
          },
        },
        githubRepos: {
          orderBy: { stargazersCount: 'desc' },
        },
        assessmentAttempts: {
          where: { assessment: { OR: [{ companyId: company.id }, { companyId: null }] } },
          orderBy: { startedAt: 'desc' },
          select: attemptSummarySelect,
        },
        evaluations: {
          where: { companyId: company.id },
          include: {
            company: {
              select: { id: true, name: true, logoUrl: true },
            },
          },
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }

    // Process attempts integrity summaries
    const attemptsWithIntegrity = (candidate.assessmentAttempts || []).map((att) => {
      const events: any[] = Array.isArray(att.integrityEvents) ? (att.integrityEvents as any[]) : [];
      const tabSwitchCount = events.filter(
        (e) => e.type === 'TAB_BLUR' || e.eventType === 'TAB_BLUR',
      ).length;
      const riskLevel: 'NORMAL' | 'REVIEW' = tabSwitchCount > 0 ? 'REVIEW' : 'NORMAL';

      return {
        ...att,
        integritySummary: {
          tabSwitchCount,
          riskLevel,
          events,
        },
      };
    });

    // Compute radar data using candidateService
    const radarData = await this.candidateService.getRadarData(candidate.userId);

    return {
      ...candidate,
      assessmentAttempts: attemptsWithIntegrity,
      radarData,
      application,
    };
  }
}

