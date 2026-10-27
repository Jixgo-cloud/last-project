import { skillAttemptSelect } from '../assessments/skill-attempt-select';
import { candidateFeedback } from '../assessments/candidate-feedback';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RadarChartDataPoint, SkillCategory, candidateSkillViews, applicationAssessmentView } from '@smartcareer/shared';

@Injectable()
export class CandidateService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        assessmentAttempts: { select: skillAttemptSelect },
        skills: {
          include: {
            skill: true,
            evidences: {
              include: { repository: true },
            },
          },
        },
        githubRepos: true,
        evaluations: {
          include: { company: true },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Candidate profile not found');
    }

    return { ...profile, skills: candidateSkillViews(profile.skills, profile.assessmentAttempts), assessmentAttempts: undefined };
  }

  async updateProfile(
    userId: string,
    data: {
      fullName?: string;
      headline?: string;
      bio?: string;
      targetCareer?: string;
      education?: any;
      experience?: any;
      githubUsername?: string;
      avatarUrl?: string;
    },
  ) {
    const existing = await this.prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (existing?.githubUsername && data.githubUsername !== undefined) {
      const cleanExisting = existing.githubUsername.toLowerCase().trim();
      const cleanNew = data.githubUsername ? data.githubUsername.toLowerCase().trim().replace(/^@/, '') : '';
      if (cleanNew !== cleanExisting) {
        throw new BadRequestException(
          `GitHub username is permanently locked to @${existing.githubUsername} and cannot be modified.`,
        );
      }
    }

    // Do not allow updating githubUsername once it has been set
    // Pick editable fields even when this service is called outside the validated controller.
    const updateData = Object.fromEntries(
      ['fullName', 'headline', 'bio', 'targetCareer', 'education', 'experience', 'githubUsername', 'avatarUrl']
        .filter(key => data[key] !== undefined).map(key => [key, data[key]]),
    );
    if (JSON.stringify([data.education, data.experience]).length > 200000) {
      throw new BadRequestException('Education and experience data is too large.');
    }
    if (existing?.githubUsername) {
      delete updateData.githubUsername;
    }

    const profile = await this.prisma.candidateProfile.upsert({
      where: { userId },
      update: {
        ...updateData,
      },
      create: {
        userId,
        fullName: data.fullName || 'Candidate',
        headline: data.headline,
        bio: data.bio,
        targetCareer: data.targetCareer || 'Full Stack Developer',
        education: data.education,
        experience: data.experience,
        githubUsername: data.githubUsername,
        avatarUrl: data.avatarUrl,
      },
      include: {
        assessmentAttempts: { select: skillAttemptSelect },
        skills: {
          include: { skill: true, evidences: true },
        },
      },
    });

    return { ...profile, skills: candidateSkillViews(profile.skills, profile.assessmentAttempts), assessmentAttempts: undefined };
  }

  async getRadarData(userId: string): Promise<RadarChartDataPoint[]> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        assessmentAttempts: { select: skillAttemptSelect },
        skills: {
          include: {
            skill: true,
            evidences: true,
          },
        },
      },
    });

    if (!profile) return this.getDefaultRadar();
    const views = candidateSkillViews(profile.skills, profile.assessmentAttempts);
    return [SkillCategory.FRONTEND, SkillCategory.BACKEND, SkillCategory.DATABASE, SkillCategory.DEVOPS, SkillCategory.TESTING].map(category => {
      const measured = views.filter(s => s.skill.category === category && s.assessmentScore !== null);
      return { category, subject: category, fullMark: 100,
        score: measured.length ? Math.round(measured.reduce((sum, s) => sum + s.assessmentScore!, 0) / measured.length) : null };
    });
  }

  async getCandidateApplications(userId: string) {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
    });
    if (!profile) return [];

    const applications = await this.prisma.jobApplication.findMany({
      where: { candidateId: profile.id },
      include: {
        job: {
          include: {
            company: true,
            skills: { include: { skill: true } },
            customAssessment: {
              select: {
                id: true,
                title: true,
                type: true,
                passingScore: true,
                timeLimitMinutes: true,
                description: true,
              },
            },
          },
        },
        assignedAssessment: {
          select: {
            id: true,
            title: true,
            type: true,
            passingScore: true,
            timeLimitMinutes: true,
            description: true,
          },
        },
        candidate: {
          select: {
            id: true,
            fullName: true,
            assessmentAttempts: {
              orderBy: { startedAt: 'desc' },
              select: {
                id: true,
                assessmentId: true,
                assessment: { select: { companyId: true, feedbackVisibility: true } },
                score: true,
                maxScore: true,
                percentage: true,
                finalScore: true,
                humanScore: true,
                reviewStatus: true,
                passed: true,
                status: true,
                startedAt: true,
                completedAt: true,
              },
            },
          },
        },
        evaluation: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return applications.map(application => ({ ...applicationAssessmentView(application), candidate: { ...application.candidate, assessmentAttempts: application.candidate.assessmentAttempts.map(attempt => candidateFeedback(attempt)) } }));
  }

  private getDefaultRadar(): RadarChartDataPoint[] {
    return [
      { category: SkillCategory.FRONTEND, subject: 'FRONTEND', score: null, fullMark: 100 },
      { category: SkillCategory.BACKEND, subject: 'BACKEND', score: null, fullMark: 100 },
      { category: SkillCategory.DATABASE, subject: 'DATABASE', score: null, fullMark: 100 },
      { category: SkillCategory.DEVOPS, subject: 'DEVOPS', score: null, fullMark: 100 },
      { category: SkillCategory.TESTING, subject: 'TESTING', score: null, fullMark: 100 },
    ];
  }
}
