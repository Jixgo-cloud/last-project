import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assessmentQuestionsMatch, getAssessmentValidationError, VerificationStatus } from '@smartcareer/shared';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalCandidates,
      totalCompanies,
      pendingVerifications,
      totalJobs,
      totalApplications,
      totalAssessments,
      totalCourses,
      recentLogs,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.candidateProfile.count(),
      this.prisma.company.count(),
      this.prisma.companyVerification.count({ where: { status: VerificationStatus.PENDING } }),
      this.prisma.job.count({ where: { isActive: true } }),
      this.prisma.jobApplication.count(),
      this.prisma.assessment.count(),
      this.prisma.course.count(),
      this.prisma.ingestionLog.findMany({
        orderBy: { startedAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      totalUsers,
      totalCandidates,
      totalCompanies,
      pendingVerifications,
      totalJobs,
      totalApplications,
      totalAssessments,
      totalCourses,
      recentLogs,
    };
  }

  async listVerifications(status?: VerificationStatus) {
    return this.prisma.companyVerification.findMany({
      where: status ? { status } : undefined,
      include: {
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewVerification(
    verificationId: string,
    adminUserId: string,
    action: 'APPROVE' | 'REJECT',
    rejectionReason?: string,
  ) {
    if (action !== 'APPROVE' && action !== 'REJECT') throw new BadRequestException('Invalid verification review action');
    const verification = await this.prisma.companyVerification.findUnique({
      where: { id: verificationId },
      include: { company: true },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    const newStatus = action === 'APPROVE' ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;

    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id = ${verification.companyId} FOR UPDATE`;
      const current = await tx.companyVerification.findUniqueOrThrow({ where: { id: verificationId } });
      const latest = await tx.companyVerification.findFirst({ where: { companyId: verification.companyId }, orderBy: { createdAt: 'desc' } });
      if (current.status !== VerificationStatus.PENDING || latest?.id !== verificationId) {
        throw new ConflictException('คำขอนี้ถูกพิจารณาแล้วหรือมีคำขอใหม่ กรุณาโหลดรายการอีกครั้ง');
      }
      const updated = await tx.companyVerification.update({
        where: { id: verificationId },
        data: {
          status: newStatus,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          rejectionReason: action === 'REJECT' ? rejectionReason : null,
        },
      });
      await tx.company.update({
        where: { id: verification.companyId },
        data: {
          verificationStatus: newStatus,
        },
      });
      return updated;
    });
  }

  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        candidateProfile: { select: { fullName: true, targetCareer: true } },
        companyMembers: { select: { company: { select: { name: true, verificationStatus: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listSkills() {
    return this.prisma.skill.findMany({
      include: {
        _count: { select: { candidateSkills: true, jobSkills: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createSkill(data: { name: string; category: any; description?: string }) {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return this.prisma.skill.create({
      data: {
        name: data.name,
        slug,
        category: data.category,
        description: data.description,
      },
    });
  }

  async listFrameworks() {
    return this.prisma.skillFramework.findMany({
      include: {
        items: {
          include: { skill: true },
        },
      },
    });
  }

  async listIngestionLogs() {
    return this.prisma.ingestionLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  // --- Admin Assessment Management ---
  async listAssessments() {
    return this.prisma.assessment.findMany({
      include: {
        skill: true,
        company: { select: { id: true, name: true, logoUrl: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAssessment(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        skill: true,
        company: { select: { id: true, name: true, logoUrl: true } },
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
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async createAssessment(data: any) {
    const validationError = getAssessmentValidationError({
      title: data.title,
      type: data.type || 'THEORY',
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
        : `assessment-${(data.type || 'theory').toLowerCase()}-${randomSuffix}`);

    return this.prisma.assessment.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        type: data.type || 'THEORY',
        skillId: data.skillId || null,
        companyId: data.companyId || null,
        timeLimitMinutes: data.timeLimitMinutes ? parseInt(data.timeLimitMinutes) : 30,
        passingScore: data.passingScore ? parseFloat(data.passingScore) : 70,
        feedbackVisibility: data.feedbackVisibility || 'IMMEDIATE',
        isActive: data.isActive !== false,
        version: 1,
        questions: {
          create: (data.questions || []).map((q: any) => ({
            title: q.title || 'คำถาม',
            prompt: q.prompt || '',
            difficulty: q.difficulty || 'MEDIUM',
            points: q.points ? parseInt(q.points) : 10,
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

  async updateAssessment(id: string, data: any) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: { questions: { include: { choices: { orderBy: { order: 'asc' } } } } },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    if (Array.isArray(data.questions)) {
      const validationError = getAssessmentValidationError({
        title: data.title ?? assessment.title,
        type: data.type ?? assessment.type,
        timeLimitMinutes: data.timeLimitMinutes ?? assessment.timeLimitMinutes,
        passingScore: data.passingScore ?? assessment.passingScore,
        questions: data.questions,
      });
      if (validationError) throw new BadRequestException(validationError);
    }

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
          // No attempts yet: safely replace all questions & choices
          await tx.question.deleteMany({ where: { assessmentId: id } });
          for (const q of data.questions) {
            await tx.question.create({
              data: {
                assessmentId: id,
                title: q.title || 'คำถาม',
                prompt: q.prompt || '',
                difficulty: q.difficulty || 'MEDIUM',
                points: q.points ? parseInt(q.points) : 10,
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
                  title: q.title || 'คำถาม',
                  prompt: q.prompt || '',
                  difficulty: q.difficulty || 'MEDIUM',
                  points: q.points ? parseInt(q.points) : 10,
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
                  title: q.title || 'คำถาม',
                  prompt: q.prompt || '',
                  difficulty: q.difficulty || 'MEDIUM',
                  points: q.points ? parseInt(q.points) : 10,
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

  async toggleAssessment(id: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException('Assessment not found');

    return this.prisma.assessment.update({
      where: { id },
      data: { isActive: !assessment.isActive },
    });
  }

  async deleteAssessment(id: string) {
    const attemptCount = await this.prisma.assessmentAttempt.count({ where: { assessmentId: id } });
    if (attemptCount > 0) {
      // Soft-delete if attempts exist
      return this.prisma.assessment.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.assessment.delete({ where: { id } });
  }

  async listAssessmentAttempts(assessmentId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: { assessmentId },
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
          },
        },
        answers: true,
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
