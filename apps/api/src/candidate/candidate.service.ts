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
          include: { skill: true },
        },
      },
    });

    if (!profile) {
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

    const radarPoints: RadarChartDataPoint[] = categories.map((cat) => {
      const skillsInCat = profile.skills.filter((cs) => cs.skill.category === cat);
      if (skillsInCat.length === 0) {
        return {
          category: cat,
          subject: cat,
          score: 20, // baseline
          fullMark: 100,
        };
      }
      const avgScore =
        skillsInCat.reduce((acc, curr) => acc + (curr.verifiedScore || curr.practicalScore || 30), 0) /
        skillsInCat.length;

      return {
        category: cat,
        subject: cat,
        score: Math.round(Math.min(100, Math.max(10, avgScore))),
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
