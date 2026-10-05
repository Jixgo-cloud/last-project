import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SkillGapItem, SkillCategory, CourseSource } from '@smartcareer/shared';
import { CAREER_DEFINITIONS } from '../jobs/jobs.service';
import { courseWithSupportedSkills, mentionsSkill } from './course-skill-evidence';

@Injectable()
export class RecommendationsService {
  // Target career benchmark expectations
  private readonly careerBenchmarks: Record<string, Record<string, number>> = {
    'Full Stack Developer': {
      'React': 80,
      'TypeScript': 75,
      'Node.js': 80,
      'PostgreSQL': 70,
      'Docker': 60,
      'Jest': 60,
    },
    'Frontend Developer': {
      'React': 85,
      'Next.js': 80,
      'TypeScript': 80,
      'Tailwind CSS': 85,
      'Jest': 65,
    },
    'Backend Developer': {
      'Node.js': 85,
      'NestJS': 80,
      'PostgreSQL': 75,
      'Docker': 70,
      'Redis': 65,
    },
    'DevOps Engineer': {
      'Docker': 85,
      'Kubernetes': 80,
      'PostgreSQL': 65,
      'Python': 70,
    },
  };

  constructor(private prisma: PrismaService) {}

  async getSkillGapsAndRecommendations(candidateUserId: string): Promise<{
    targetCareer: string;
    gaps: SkillGapItem[];
  }> {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId: candidateUserId },
      include: {
        skills: { include: { skill: true } },
        evaluations: true,
      },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }

    const targetCareer = candidate.targetCareer || 'Full Stack Developer';
    const benchmark = this.careerBenchmarks[targetCareer] || this.careerBenchmarks['Full Stack Developer'];

    // Map candidate scores
    const candidateScores = new Map<string, number>();
    for (const cs of candidate.skills) {
      candidateScores.set(cs.skill.name.toLowerCase(), cs.verifiedScore || cs.practicalScore || cs.theoryScore);
    }

    const gaps: SkillGapItem[] = [];

    for (const [skillName, requiredLevel] of Object.entries(benchmark)) {
      const currentLevel = candidateScores.get(skillName.toLowerCase()) || 20;
      const gap = Math.max(0, requiredLevel - currentLevel);

      if (gap > 5) {
        // Find skill entity
        const skill = await this.prisma.skill.findUnique({
          where: { name: skillName },
        });

        // Find relevant courses
        const courses = await this.prisma.course.findMany({
          where: {
            OR: [
              { title: { contains: skillName, mode: 'insensitive' } },
              { description: { contains: skillName, mode: 'insensitive' } },
              skill ? { skills: { some: { skillId: skill.id } } } : {},
            ],
          },
          include: { skills: { include: { skill: true } } },
        });

        gaps.push({
          skillId: skill?.id || skillName,
          skillName,
          category: (skill?.category as SkillCategory) || SkillCategory.BACKEND,
          requiredLevel,
          currentLevel,
          gap,
          priority: gap >= 30 ? 'HIGH' : gap >= 15 ? 'MEDIUM' : 'LOW',
          recommendedCourses: courses.map(courseWithSupportedSkills).filter((c) =>
            mentionsSkill(`${c.title} ${c.description || ''}`, skillName) || c.skills.some((link) => link.skillId === skill?.id)
          ).slice(0, 3).map((c) => ({
            id: c.id,
            title: c.title,
            provider: c.provider as CourseSource,
            url: c.url,
            thumbnail: c.thumbnailUrl,
            level: c.level,
          })),
        });
      }
    }

    // Sort by highest gap first
    gaps.sort((a, b) => b.gap - a.gap);

    return {
      targetCareer,
      gaps,
    };
  }

  async getAllCourses(filters?: {
    keyword?: string;
    provider?: CourseSource;
    career?: string;
    skillId?: string;
  }) {
    const where: any = {};

    if (filters?.provider) {
      where.provider = filters.provider;
    }

    if (filters?.keyword) {
      where.OR = [
        { title: { contains: filters.keyword, mode: 'insensitive' } },
        { description: { contains: filters.keyword, mode: 'insensitive' } },
      ];
    }

    if (filters?.skillId && filters.skillId !== 'ALL') {
      where.skills = {
        some: { skillId: filters.skillId },
      };
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

    const courses = await this.prisma.course.findMany({
      where,
      include: {
        skills: { include: { skill: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const seenUrls = new Set<string>();
    return courses.map(courseWithSupportedSkills).filter((course) => {
      if (filters?.skillId && filters.skillId !== 'ALL' && !course.skills.some((link) => link.skillId === filters.skillId)) return false;
      const career = filters?.career && CAREER_DEFINITIONS[filters.career];
      if (career && !course.skills.some((link) => career.categories.includes(link.skill.category as SkillCategory)) && !career.keywords.some((word) => mentionsSkill(course.title, word))) return false;
      let normalizedUrl: string;
      try {
        const parsedUrl = new URL(course.url);
        parsedUrl.hash = '';
        parsedUrl.hostname = parsedUrl.hostname.replace(/^www\./i, '');
        parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';

        for (const key of Array.from(parsedUrl.searchParams.keys())) {
          if (/^(utm_.+|ref|referrer|couponcode|fbclid|gclid|feature|si)$/i.test(key)) {
            parsedUrl.searchParams.delete(key);
          }
        }

        parsedUrl.searchParams.sort();
        normalizedUrl = parsedUrl.toString().replace(/\/$/, '');
      } catch {
        normalizedUrl = course.url.trim().replace(/\/+$/, '').toLowerCase();
      }

      if (seenUrls.has(normalizedUrl)) return false;
      seenUrls.add(normalizedUrl);
      return true;
    });
  }
}

