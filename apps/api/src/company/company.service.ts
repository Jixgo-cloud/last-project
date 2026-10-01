import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationStatus, ApplicationStatus } from '@smartcareer/shared';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.company.update({
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
  }

  async submitVerification(userId: string, businessRegNo: string, documents?: any) {
    const company = await this.getCompanyByUserId(userId);

    const verification = await this.prisma.companyVerification.create({
      data: {
        companyId: company.id,
        businessRegNo,
        documents: documents || { taxId: businessRegNo, submittedDate: new Date().toISOString() },
        status: VerificationStatus.PENDING,
      },
    });

    await this.prisma.company.update({
      where: { id: company.id },
      data: { verificationStatus: VerificationStatus.PENDING },
    });

    return verification;
  }

  async createJob(userId: string, jobDto: any) {
    const company = await this.getCompanyByUserId(userId);

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
        salaryMin: jobDto.salaryMin ? parseInt(jobDto.salaryMin) : null,
        salaryMax: jobDto.salaryMax ? parseInt(jobDto.salaryMax) : null,
        salaryCurrency: jobDto.salaryCurrency || 'THB',
        acceptedQuota: jobDto.acceptedQuota ? parseInt(jobDto.acceptedQuota) : null,
        source: 'INTERNAL',
        customAssessmentId: jobDto.customAssessmentId || null,
        skills: {
          create: (jobDto.skills || []).map((s: { skillId: string; isRequired?: boolean; minimumScore?: number }) => ({
            skillId: s.skillId,
            isRequired: s.isRequired !== false,
            minimumScore: s.minimumScore || 50,
          })),
        },
      },
      include: {
        skills: { include: { skill: true } },
      },
    });

    return job;
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
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, companyId: company.id },
    });
    if (!job) throw new NotFoundException('Job not found or unauthorized');

    return this.prisma.job.delete({
      where: { id: jobId },
    });
  }

  async getApplications(userId: string, jobId?: string) {
    const company = await this.getCompanyByUserId(userId);

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
              },
            },
          },
        },
        candidate: {
          include: {
            user: { select: { email: true } },
            skills: { include: { skill: true } },
            githubRepos: { take: 3 },
            assessmentAttempts: {
              orderBy: { startedAt: 'desc' },
              take: 5,
              include: {
                assessment: {
                  select: { id: true, title: true, passingScore: true, type: true },
                },
              },
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
  ) {
    const company = await this.getCompanyByUserId(userId);

    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { job: true },
    });

    if (!application || application.job.companyId !== company.id) {
      throw new ForbiddenException('Cannot update application for another company');
    }

    const previousStatus = application.status;

    const updated = await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        internalNote: note ? `${application.internalNote || ''}\n[${new Date().toISOString()}] ${note}` : application.internalNote,
        statusHistory: {
          create: {
            previousStatus,
            newStatus,
            changedById: userId,
            note: note || `Status updated to ${newStatus}`,
          },
        },
      },
      include: {
        statusHistory: true,
      },
    });

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

    return this.prisma.assessment.findMany({
      where: { companyId: company.id },
      include: {
        skill: true,
        _count: { select: { questions: true, attempts: true, jobs: true } },
      },
      orderBy: { createdAt: 'desc' },
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
        passingScore: data.passingScore ? parseFloat(data.passingScore) : 70,
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
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment || assessment.companyId !== company.id) {
      throw new ForbiddenException('You are not authorized to edit this assessment');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update questions if provided in payload
      if (Array.isArray(data.questions)) {
        const attemptCount = await tx.assessmentAttempt.count({ where: { assessmentId: id } });

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
        data: {
          title: data.title ?? assessment.title,
          description: data.description ?? assessment.description,
          type: data.type ?? assessment.type,
          timeLimitMinutes: data.timeLimitMinutes ? parseInt(data.timeLimitMinutes) : assessment.timeLimitMinutes,
          passingScore: data.passingScore ? parseFloat(data.passingScore) : assessment.passingScore,
          feedbackVisibility: data.feedbackVisibility ?? assessment.feedbackVisibility,
          skillId: data.skillId !== undefined ? data.skillId : assessment.skillId,
          isActive: data.isActive !== undefined ? data.isActive : assessment.isActive,
          version: { increment: 1 },
        },
        include: {
          skill: true,
          questions: { include: { choices: true } },
        },
      });
    });
  }

  async toggleCompanyAssessment(userId: string, id: string) {
    const company = await this.getCompanyByUserId(userId);
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment || assessment.companyId !== company.id) {
      throw new ForbiddenException('You are not authorized to toggle this assessment');
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
      let riskLevel: 'NORMAL' | 'SUSPICIOUS' | 'HIGH_RISK' = 'NORMAL';
      if (tabSwitchCount >= 8) riskLevel = 'HIGH_RISK';
      else if (tabSwitchCount >= 3) riskLevel = 'SUSPICIOUS';

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
}
