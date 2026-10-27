import { skillAttemptSelect } from '../assessments/skill-attempt-select';
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SkillGapItem, SkillCategory, CourseSource, assessedSkills, getAssessmentValidationError } from '@smartcareer/shared';
import { CAREER_DEFINITIONS } from '../jobs/jobs.service';
import { selectRelevantCourses, uniqueCourses } from './course-selection';
import { courseWithSupportedSkills, mentionsSkill } from './course-skill-evidence';

@Injectable()
export class RecommendationsService {
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
          const recommendedCourses = selectRelevantCourses(courses, [skill.name], 3)
            .map(course => ({ id: course.id, title: course.title, url: course.url, provider: course.provider }));
          const progress = development.progress?.[skill.id] || { status: 'NOT_STARTED', note: '', evidenceUrl: '', updatedAt: null, completedAt: null };
          return { id: skill.id, name: skill.name, recommendedCourses, progress,
            needsReview: !!progress.updatedAt && progress.reviewedRevision !== development.updatedAt,
            steps: [`ทบทวนข้อเสนอแนะเรื่อง ${skill.name}`, `เรียนและทำแบบฝึกหัด ${skill.name}`, `สร้างผลงานที่แสดง ${skill.name} แล้วเพิ่มใน GitHub`, 'ทบทวนผลกับบริษัทหรือทำแบบทดสอบที่เกี่ยวข้อง'] };
        }) : [],
      };
    }) };
  }

  async getSkillGapsAndRecommendations(candidateUserId: string) {
    const candidate = await this.prisma.candidateProfile.findUnique({ where: { userId: candidateUserId } });
    if (!candidate) throw new NotFoundException('Candidate profile not found');
    const [attempts, jobs, exams] = await Promise.all([
      this.prisma.assessmentAttempt.findMany({ where: { candidateId: candidate.id, status: 'COMPLETED', assessment: { companyId: null } }, select: skillAttemptSelect }),
      this.prisma.job.findMany({ where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, include: { skills: { include: { skill: true } } } }),
      this.prisma.assessment.findMany({ where: { isActive: true, companyId: null, type: 'PRACTICAL_CODING' }, include: { questions: { include: { choices: true } } } }),
    ]);
    const targetCareer = candidate.targetCareer || '';
    const normalized = targetCareer.toLowerCase().replace(/[-_]/g, ' ').trim();
    const track = CAREER_DEFINITIONS[targetCareer] || Object.values(CAREER_DEFINITIONS).find(d =>
      d.keywords.some(k => normalized.includes(k.replace(/-/g, ' '))));
    const keywords = track?.keywords || (targetCareer ? [targetCareer] : []);
    const relevantJobs = jobs.filter(job => !/^PILOT-QA-/i.test(job.title) && !/\(UAT QA\)/i.test(job.companyName) &&
      (!targetCareer || keywords.some(k => job.title.toLowerCase().includes(k.toLowerCase()))));
    const demand = new Map<string, { skill: any; requiredLevel: number; requiredJobCount: number; jobIds: string[] }>();
    for (const job of relevantJobs) for (const link of job.skills) {
      if (!Number.isFinite(link.minimumScore) || link.minimumScore <= 0 || link.minimumScore > 100) continue;
      const row = demand.get(link.skillId) || { skill: link.skill, requiredLevel: 0, requiredJobCount: 0, jobIds: [] };
      row.requiredLevel = Math.max(row.requiredLevel, link.minimumScore);
      row.requiredJobCount += link.isRequired ? 1 : 0;
      if (!row.jobIds.includes(job.id)) row.jobIds.push(job.id);
      demand.set(link.skillId, row);
    }
    const results = assessedSkills(attempts);
    const priorities = [...demand.values()].sort((a, b) => b.requiredJobCount - a.requiredJobCount || b.jobIds.length - a.jobIds.length || a.skill.name.localeCompare(b.skill.name)).slice(0, 5);
    const assessmentPlan = priorities.map(row => {
      const result = results.get(row.skill.id);
      return { skillId: row.skill.id, skillName: row.skill.name, requiredLevel: row.requiredLevel,
        currentLevel: result?.score ?? null, status: !result ? 'NOT_ASSESSED' : result.score < row.requiredLevel ? 'GAP' : 'ASSESSED',
        attemptId: result?.attemptId ?? null, jobIds: row.jobIds, requiredJobCount: row.requiredJobCount,
        assessments: exams.filter(exam => exam.skillId === row.skill.id && !getAssessmentValidationError(exam) &&
          exam.questions.every(q => q.evaluationMethod === 'AUTOMATED_TEST_CASES' && Array.isArray(q.testCases) && q.testCases.length > 0))
          .map(exam => ({ id: exam.id, title: exam.title, passingScore: exam.passingScore, qualityStatus: 'PENDING_EXPERT_REVIEW_AND_PILOT' })),
      };
    });
    const gaps: SkillGapItem[] = [];
    for (const row of assessmentPlan.filter(row => row.status === 'GAP')) {
      const courses = await this.prisma.course.findMany({ where: { OR: [
        { skills: { some: { skillId: row.skillId } } }, { title: { contains: row.skillName, mode: 'insensitive' } },
      ] }, include: { skills: { include: { skill: true } } } });
      const gap = row.requiredLevel - row.currentLevel!;
      gaps.push({ skillId: row.skillId, skillName: row.skillName, category: demand.get(row.skillId)!.skill.category,
        requiredLevel: row.requiredLevel, currentLevel: row.currentLevel!, gap,
        priority: gap >= 30 ? 'HIGH' : gap >= 15 ? 'MEDIUM' : 'LOW',
        recommendedCourses: selectRelevantCourses(courses, [row.skillName], 3).map(c => ({ id: c.id, title: c.title, provider: c.provider as CourseSource, url: c.url, thumbnail: c.thumbnailUrl, level: c.level })),
      });
    }
    gaps.sort((a, b) => b.gap - a.gap);
    return { targetCareer, gaps, assessmentPlan, unassessedSkills: assessmentPlan.filter(row => row.status === 'NOT_ASSESSED'),
      basis: 'ACTIVE_JOB_REQUIREMENTS', relevantJobCount: relevantJobs.length, priorityLimit: 5,
      benchmarkPolicy: 'Maximum stated minimum per skill in relevant active jobs; pending expert calibration' };
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

    return uniqueCourses(courses.map(courseWithSupportedSkills).filter((course) => {
      if (filters?.skillId && filters.skillId !== 'ALL' && !course.skills.some((link) => link.skillId === filters.skillId)) return false;
      const career = filters?.career && CAREER_DEFINITIONS[filters.career];
      if (career && !course.skills.some((link) => career.categories.includes(link.skill.category as SkillCategory)) && !career.keywords.some((word) => mentionsSkill(course.title, word))) return false;
      return true;
    }));
  }
}

