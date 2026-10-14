import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SkillGapItem, SkillCategory, CourseSource, githubEvidenceScore } from '@smartcareer/shared';
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

  async updateLearningProgress(userId: string, evaluationId: string, skillId: string, input: any) {
    if (!input || !['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(input.status)
      || typeof input.note !== 'string' || input.note.length > 2000
      || typeof input.evidenceUrl !== 'string' || input.evidenceUrl.length > 2000
      || typeof input.revision !== 'string' || (input.expectedUpdatedAt !== null && typeof input.expectedUpdatedAt !== 'string')
      || Object.keys(input).some(key => !['status','note','evidenceUrl','revision','expectedUpdatedAt'].includes(key))) {
      throw new BadRequestException('ข้อมูลความคืบหน้าไม่ถูกต้อง');
    }
    const evidenceUrl = input.evidenceUrl.trim();
    if (evidenceUrl) {
      try { const url = new URL(evidenceUrl); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
      catch { throw new BadRequestException('ลิงก์ผลงานต้องเป็น HTTPS และไม่มีชื่อผู้ใช้หรือรหัสผ่านในลิงก์'); }
    }
    return this.prisma.$transaction(async tx => {
      const owned = await tx.companyEvaluation.findFirst({ where: { id: evaluationId, candidate: { userId } } });
      if (!owned) throw new NotFoundException('ไม่พบแผนการเรียนรู้');
      await tx.$queryRaw`SELECT id FROM job_applications WHERE id = ${owned.applicationId} FOR UPDATE`;
      const evaluation = await tx.companyEvaluation.findUnique({ where: { id: evaluationId } });
      const development = evaluation?.areasForImprovement as any;
      if (development?.version !== 1 || !development.skillIds?.includes(skillId)) throw new NotFoundException('ไม่พบทักษะในแผนนี้');
      const previous = development.progress?.[skillId];
      if (development.updatedAt !== input.revision || (previous?.updatedAt || null) !== input.expectedUpdatedAt) {
        throw new ConflictException('แผนหรือความคืบหน้ามีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก');
      }
      const now = new Date(Math.max(Date.now(), (Date.parse(previous?.updatedAt) || 0) + 1)).toISOString();
      const progress = { status: input.status, note: input.note.trim(), evidenceUrl, updatedAt: now,
        completedAt: input.status === 'COMPLETED' ? (previous?.completedAt || now) : null, reviewedRevision: development.updatedAt };
      await tx.companyEvaluation.update({ where: { id: evaluationId }, data: {
        areasForImprovement: { ...development, progress: { ...(development.progress || {}), [skillId]: progress } },
      } });
      return progress;
    });
  }

  async getDevelopmentPlan(candidateUserId: string) {
    const candidate = await this.prisma.candidateProfile.findUnique({ where: { userId: candidateUserId } });
    if (!candidate) throw new NotFoundException('Candidate profile not found');
    const evaluations = await this.prisma.companyEvaluation.findMany({
      where: { candidateId: candidate.id },
      include: { company: { select: { name: true } }, application: { include: { job: { select: { title: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    const skills = await this.prisma.skill.findMany();
    const courses = await this.prisma.course.findMany({ include: { skills: { include: { skill: true } } }, orderBy: { createdAt: 'desc' } });
    return { evaluations: evaluations.map(evaluation => {
      const development = evaluation.areasForImprovement as any;
      const explicit = development?.version === 1 && Array.isArray(development.skillIds);
      return {
        id: evaluation.id, applicationId: evaluation.applicationId, company: evaluation.company.name,
        job: evaluation.application.job.title, updatedAt: explicit ? development.updatedAt : evaluation.createdAt,
        overallFeedback: evaluation.overallFeedback,
        scores: { technical: evaluation.technicalScore, problemSolving: evaluation.problemSolvingScore, communication: evaluation.communicationScore, teamwork: evaluation.teamworkScore },
        strengths: explicit && Array.isArray(evaluation.strengths) ? evaluation.strengths : [],
        note: explicit ? development.note : '', legacy: !explicit,
        skills: explicit ? skills.filter(skill => development.skillIds.includes(skill.id)).map(skill => {
          const seen = new Set<string>();
          const recommendedCourses = courses.map(courseWithSupportedSkills).filter(course => {
            if (!/^https?:\/\//i.test(course.url) || seen.has(course.url)) return false;
            if (!course.skills.some(link => link.skillId === skill.id) && !mentionsSkill(`${course.title} ${course.description || ''}`, skill.name)) return false;
            seen.add(course.url); return true;
          }).slice(0, 3).map(course => ({ id: course.id, title: course.title, url: course.url, provider: course.provider }));
          const progress = development.progress?.[skill.id] || { status: 'NOT_STARTED', note: '', evidenceUrl: '', updatedAt: null, completedAt: null };
          return { id: skill.id, name: skill.name, recommendedCourses, progress,
            needsReview: !!progress.updatedAt && progress.reviewedRevision !== development.updatedAt,
            steps: [`ทบทวนข้อเสนอแนะเรื่อง ${skill.name}`, `เรียนและทำแบบฝึกหัด ${skill.name}`, `สร้างผลงานที่แสดง ${skill.name} แล้วเพิ่มใน GitHub`, 'ทบทวนผลกับบริษัทหรือทำแบบทดสอบที่เกี่ยวข้อง'] };
        }) : [],
      };
    }) };
  }

  async getSkillGapsAndRecommendations(candidateUserId: string): Promise<{
    targetCareer: string;
    gaps: SkillGapItem[];
  }> {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId: candidateUserId },
      include: {
        skills: { include: { skill: true, evidences: true } },
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
      candidateScores.set(cs.skill.name.toLowerCase(), githubEvidenceScore(cs));
    }

    const gaps: SkillGapItem[] = [];

    for (const [skillName, requiredLevel] of Object.entries(benchmark)) {
      const currentLevel = candidateScores.get(skillName.toLowerCase()) ?? 0;
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

