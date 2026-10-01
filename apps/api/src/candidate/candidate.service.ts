import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RadarChartDataPoint, SkillCategory } from '@smartcareer/shared';

@Injectable()
export class CandidateService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
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

    return profile;
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
    const updateData = { ...data };
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
        skills: {
          include: { skill: true },
        },
      },
    });

    return profile;
  }

  async getRadarData(userId: string): Promise<RadarChartDataPoint[]> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        skills: {
          include: {
            skill: true,
            evidences: true,
          },
        },
      },
    });

    if (!profile || !profile.skills || profile.skills.length === 0) {
      return this.getDefaultRadar();
    }

    // Default categories to show on radar
    const categories = [
      SkillCategory.FRONTEND,
      SkillCategory.BACKEND,
      SkillCategory.DATABASE,
      SkillCategory.DEVOPS,
      SkillCategory.TESTING,
    ];

    const skillCountMap = new Map<
      string,
      { count: number; category: SkillCategory; totalWeight: number; bonus: number }
    >();

    for (const cs of profile.skills) {
      const evidences = cs.evidences || [];
      const uniqueRepoCount = new Set(evidences.map((e) => e.repositoryId)).size || 1;
      const totalWeight = uniqueRepoCount * 20;
      const bonus = Math.round((cs.theoryScore || 0) * 0.2 + (cs.codingScore || 0) * 0.3);

      skillCountMap.set(cs.skill.name, {
        count: uniqueRepoCount,
        category: cs.skill.category as unknown as SkillCategory,
        totalWeight,
        bonus,
      });
    }

    const radarPoints: RadarChartDataPoint[] = categories.map((cat) => {
      const skillsInCat = Array.from(skillCountMap.entries()).filter(
        ([_, data]) => data.category === cat,
      );

      if (skillsInCat.length === 0) {
        return {
          category: cat,
          subject: cat,
          score: 35, // realistic baseline for unexercised category
          fullMark: 100,
        };
      }

      const totalScore = skillsInCat.reduce((acc, [_, d]) => acc + d.totalWeight + d.count * 12, 0);
      const avgScore = Math.min(95, Math.max(45, Math.round(50 + totalScore / (skillsInCat.length * 1.5))));
      const bonusAvg = Math.round(
        skillsInCat.reduce((acc, [_, d]) => acc + d.bonus, 0) / skillsInCat.length,
      );

      return {
        category: cat,
        subject: cat,
        score: Math.min(100, avgScore + bonusAvg),
        fullMark: 100,
      };
    });

    return radarPoints;
  }

  async getCandidateApplications(userId: string) {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
    });
    if (!profile) return [];

    return this.prisma.jobApplication.findMany({
      where: { candidateId: profile.id },
      include: {
        job: {
          include: {
            company: true,
            skills: { include: { skill: true } },
          },
        },
        evaluation: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private getDefaultRadar(): RadarChartDataPoint[] {
    return [
      { category: SkillCategory.FRONTEND, subject: 'FRONTEND', score: 30, fullMark: 100 },
      { category: SkillCategory.BACKEND, subject: 'BACKEND', score: 30, fullMark: 100 },
      { category: SkillCategory.DATABASE, subject: 'DATABASE', score: 30, fullMark: 100 },
      { category: SkillCategory.DEVOPS, subject: 'DEVOPS', score: 20, fullMark: 100 },
      { category: SkillCategory.TESTING, subject: 'TESTING', score: 25, fullMark: 100 },
    ];
  }
}
