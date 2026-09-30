import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationStatus, UserRole } from '@smartcareer/shared';

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
    const verification = await this.prisma.companyVerification.findUnique({
      where: { id: verificationId },
      include: { company: true },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    const newStatus = action === 'APPROVE' ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;

    const updated = await this.prisma.$transaction([
      this.prisma.companyVerification.update({
        where: { id: verificationId },
        data: {
          status: newStatus,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          rejectionReason: action === 'REJECT' ? rejectionReason : null,
        },
      }),
      this.prisma.company.update({
        where: { id: verification.companyId },
        data: {
          verificationStatus: newStatus,
        },
      }),
    ]);

    return updated[0];
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

  async createAssessment(data: any) {
    const slug =
      (data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')) +
      '-' +
      Math.floor(1000 + Math.random() * 9000);

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
            title: q.title,
            prompt: q.prompt,
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
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException('Assessment not found');

    return this.prisma.assessment.update({
      where: { id },
      data: {
        title: data.title ?? assessment.title,
        description: data.description ?? assessment.description,
        timeLimitMinutes: data.timeLimitMinutes ? parseInt(data.timeLimitMinutes) : assessment.timeLimitMinutes,
        passingScore: data.passingScore ? parseFloat(data.passingScore) : assessment.passingScore,
        feedbackVisibility: data.feedbackVisibility ?? assessment.feedbackVisibility,
        skillId: data.skillId !== undefined ? data.skillId : assessment.skillId,
        isActive: data.isActive !== undefined ? data.isActive : assessment.isActive,
        version: { increment: 1 },
      },
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
}
