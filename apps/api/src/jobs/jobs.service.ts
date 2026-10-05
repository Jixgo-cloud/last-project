import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { honestJobContent } from './job-content';
import { JobType, JobSource, SkillCategory, CareerTrack } from '@smartcareer/shared';

export const CAREER_DEFINITIONS: Record<string, { categories: SkillCategory[]; keywords: string[] }> = {
  [CareerTrack.FULL_STACK]: {
    categories: [SkillCategory.FRONTEND, SkillCategory.BACKEND],
    keywords: ['full stack', 'fullstack', 'full-stack'],
  },
  [CareerTrack.FRONTEND]: {
    categories: [SkillCategory.FRONTEND],
    keywords: ['frontend', 'front-end', 'front end', 'react', 'next.js', 'vue', 'angular', 'web developer'],
  },
  [CareerTrack.BACKEND]: {
    categories: [SkillCategory.BACKEND],
    keywords: ['backend', 'back-end', 'back end', 'node', 'nestjs', 'express', 'python', 'fastapi', 'java', 'golang', 'api'],
  },
  [CareerTrack.DEVOPS]: {
    categories: [SkillCategory.DEVOPS],
    keywords: ['devops', 'cloud', 'sre', 'docker', 'kubernetes', 'aws', 'infrastructure', 'platform engineer', 'ci/cd'],
  },
  [CareerTrack.DATA_AI]: {
    categories: [SkillCategory.DATABASE, SkillCategory.AI_ML],
    keywords: ['data', 'ai', 'machine learning', 'database', 'sql', 'python', 'etl', 'analytics', 'data engineer'],
  },
  [CareerTrack.MOBILE]: {
    categories: [SkillCategory.MOBILE],
    keywords: ['mobile', 'ios', 'android', 'flutter', 'react native', 'swift', 'kotlin'],
  },
  [CareerTrack.TESTING]: {
    categories: [SkillCategory.TESTING],
    keywords: ['qa', 'tester', 'test', 'quality assurance', 'cypress', 'jest', 'automation'],
  },
  [CareerTrack.SECURITY]: {
    categories: [SkillCategory.SECURITY],
    keywords: ['security', 'cyber', 'pentest', 'soc', 'infosec'],
  },
};

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private matchingService: MatchingService,
  ) {}

  async findAll(filters?: {
    keyword?: string;
    location?: string;
    isRemote?: boolean;
    employmentType?: JobType;
    source?: JobSource;
    career?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
    candidateUserId?: string;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
      AND: [
        {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      ],
    };

    if (filters?.keyword) {
      where.OR = [
        { title: { contains: filters.keyword, mode: 'insensitive' } },
        { description: { contains: filters.keyword, mode: 'insensitive' } },
        { companyName: { contains: filters.keyword, mode: 'insensitive' } },
      ];
    }

    if (filters?.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }

    if (filters?.isRemote !== undefined) {
      where.isRemote = filters.isRemote;
    }

    if (filters?.employmentType) {
      where.employmentType = filters.employmentType;
    }

    if (filters?.source) {
      where.source = filters.source;
    }

    if (filters?.career && filters.career !== 'ALL' && CAREER_DEFINITIONS[filters.career]) {
      const def = CAREER_DEFINITIONS[filters.career];
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          {
            skills: {
              some: {
                skill: {
                  category: { in: def.categories },
                },
              },
            },
          },
          ...def.keywords.map((kw) => ({
            title: { contains: kw, mode: 'insensitive' as const },
          })),
        ],
      });
    }

    let candidateProfile: any = null;
    if (filters?.candidateUserId) {
      candidateProfile = await this.prisma.candidateProfile.findUnique({
        where: { userId: filters.candidateUserId },
      });
    }

    const total = await this.prisma.job.count({ where });

    let jobs: any[];
    if (filters?.sortBy === 'matchScore' && candidateProfile) {
      const allMatchingJobs = await this.prisma.job.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, logoUrl: true, verificationStatus: true } },
          skills: { include: { skill: true } },
          _count: { select: { applications: true } },
        },
      });

      const scoreMap = await this.matchingService.calculateBatchMatchScores(
        candidateProfile.id,
        allMatchingJobs,
      );

      const scoredJobs = allMatchingJobs.map((j) => ({
        ...j,
        matchScore: scoreMap.get(j.id) ?? 40,
      }));

      scoredJobs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      jobs = scoredJobs.slice(skip, skip + limit);
    } else {
      let orderBy: any = { publishedAt: 'desc' };
      if (filters?.sortBy === 'salary') {
        orderBy = { salaryMax: 'desc' };
      }

      jobs = await this.prisma.job.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, logoUrl: true, verificationStatus: true } },
          skills: { include: { skill: true } },
          _count: { select: { applications: true } },
        },
        orderBy,
        skip,
        take: limit,
      });

      if (candidateProfile) {
        const scoreMap = await this.matchingService.calculateBatchMatchScores(
          candidateProfile.id,
          jobs,
        );
        jobs = jobs.map((j) => ({
          ...j,
          matchScore: scoreMap.get(j.id) ?? 40,
        }));
      }
    }

    if (candidateProfile) {
      const favs = await this.prisma.jobFavorite.findMany({
        where: { candidateId: candidateProfile.id },
        select: { jobId: true },
      });
      const favSet = new Set(favs.map((f) => f.jobId));
      jobs = jobs.map((j) => ({
        ...j,
        isFavorited: favSet.has(j.id),
      }));
    }

    return {
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, candidateUserId?: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        company: true,
        skills: {
          include: { skill: true },
        },
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
        _count: { select: { applications: true } },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    let matchScore = null;
    let isFavorited = false;
    if (candidateUserId) {
      const candidate = await this.prisma.candidateProfile.findUnique({
        where: { userId: candidateUserId },
      });
      if (candidate) {
        matchScore = await this.matchingService.calculateMatchScore(candidate.id, job.id);
        const fav = await this.prisma.jobFavorite.findUnique({
          where: {
            candidateId_jobId: {
              candidateId: candidate.id,
              jobId: job.id,
            },
          },
        });
        isFavorited = !!fav;
      }
    }

    // Recommend courses specifically for missing skills if candidate has gaps,
    // or for top required skills of the job if candidate is not logged in / no gaps
    let targetSkillNames: string[] = [];
    let isPersonalizedForGap = false;

    if (matchScore && matchScore.missingSkills && matchScore.missingSkills.length > 0) {
      targetSkillNames = matchScore.missingSkills.map((s: any) => s.name);
      isPersonalizedForGap = true;
    } else {
      targetSkillNames = job.skills.map((s: any) => s.skill.name);
    }

    let recommendedCourses: any[] = [];
    if (targetSkillNames.length > 0) {
      const courses = await this.prisma.course.findMany({
        where: {
          OR: [
            {
              skills: {
                some: {
                  skill: {
                    name: { in: targetSkillNames, mode: 'insensitive' as const },
                  },
                },
              },
            },
            ...targetSkillNames.map((sn) => ({ title: { contains: sn, mode: 'insensitive' as const } })),
          ],
        },
        include: {
          skills: { include: { skill: true } },
        },
        take: 6,
      });

      recommendedCourses = courses.map((c) => {
        const matchedSkill = c.skills?.find((cs: any) =>
          targetSkillNames.some((ts) => ts.toLowerCase() === cs.skill.name.toLowerCase()),
        );
        return {
          ...c,
          targetSkill: matchedSkill ? matchedSkill.skill.name : targetSkillNames[0] || null,
          isGapCloser: isPersonalizedForGap,
        };
      });
    }

    return {
      ...job,
      ...honestJobContent(job),
      isFavorited,
      matchScore,
      recommendedCourses,
    };
  }

  async toggleFavorite(candidateUserId: string, jobId: string) {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId: candidateUserId },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found');

    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    const existing = await this.prisma.jobFavorite.findUnique({
      where: {
        candidateId_jobId: {
          candidateId: candidate.id,
          jobId,
        },
      },
    });

    if (existing) {
      await this.prisma.jobFavorite.delete({
        where: { id: existing.id },
      });
      return { isFavorited: false, message: 'Removed from favorites' };
    } else {
      await this.prisma.jobFavorite.create({
        data: {
          candidateId: candidate.id,
          jobId,
        },
      });
      return { isFavorited: true, message: 'Added to favorites' };
    }
  }

  async getFavorites(candidateUserId: string) {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId: candidateUserId },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found');

    const favorites = await this.prisma.jobFavorite.findMany({
      where: { candidateId: candidate.id },
      include: {
        job: {
          include: {
            company: { select: { id: true, name: true, logoUrl: true, verificationStatus: true } },
            skills: { include: { skill: true } },
            _count: { select: { applications: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return favorites.map((f) => ({
      ...f.job,
      isFavorited: true,
      favoritedAt: f.createdAt,
    }));
  }

  async getMatchScore(jobId: string, candidateUserId: string) {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId: candidateUserId },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found');

    return this.matchingService.calculateMatchScore(candidate.id, jobId);
  }
}
