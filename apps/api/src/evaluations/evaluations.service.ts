import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EvaluationsService {
  constructor(private prisma: PrismaService) {}

  async evaluateCandidate(
    companyUserId: string,
    applicationId: string,
    data: {
      technicalScore: number;
      problemSolvingScore: number;
      communicationScore: number;
      teamworkScore: number;
      overallFeedback: string;
      strengths?: string[];
      areasForImprovement?: string[];
      developmentSkillIds?: string[];
      developmentNote?: string;
    },
  ) {
    if (!data || !['technicalScore', 'problemSolvingScore', 'communicationScore', 'teamworkScore'].every(key => Number.isInteger(data[key]) && data[key] >= 1 && data[key] <= 5)
      || typeof data.overallFeedback !== 'string' || !data.overallFeedback.trim() || data.overallFeedback.length > 5000) {
      throw new BadRequestException('กรุณาให้คะแนน 1–5 และกรอกข้อเสนอแนะไม่เกิน 5,000 ตัวอักษร');
    }
    const ids = data.developmentSkillIds ?? [];
    if (!Array.isArray(ids) || ids.length > 10 || ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length
      || (data.developmentNote != null && (typeof data.developmentNote !== 'string' || data.developmentNote.length > 3000))
      || (data.strengths != null && (!Array.isArray(data.strengths) || data.strengths.length > 10 || data.strengths.some(s => typeof s !== 'string' || s.length > 300)))) {
      throw new BadRequestException('ข้อมูลแผนพัฒนาไม่ถูกต้อง เลือกได้สูงสุด 10 ทักษะ');
    }
    const member = await this.prisma.companyMember.findFirst({
      where: { userId: companyUserId },
    });
    if (!member) throw new ForbiddenException('User is not associated with a company');

    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { job: true },
    });
    if (!application || application.job.companyId !== member.companyId) {
      throw new ForbiddenException('Cannot evaluate application for another company');
    }

    const skills = await this.prisma.skill.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    if (skills.length !== ids.length) throw new BadRequestException('มีทักษะที่ไม่พบในระบบ กรุณาเลือกใหม่');
    const development = { version: 1, updatedAt: new Date().toISOString(), skillIds: ids, note: data.developmentNote?.trim() || '' };

    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM job_applications WHERE id = ${applicationId} FOR UPDATE`;
    const previous = await tx.companyEvaluation.findUnique({ where: { applicationId } });
    const oldDevelopment = previous?.areasForImprovement as any;
    const comparable = (value: any, plan: any) => JSON.stringify([
      value.technicalScore, value.problemSolvingScore, value.communicationScore, value.teamworkScore,
      value.overallFeedback.trim(), value.strengths || [], [...(plan?.skillIds || [])].sort(), plan?.note || '',
    ]);
    if (previous && oldDevelopment?.version === 1 && comparable(previous, oldDevelopment) === comparable(data, development)) return previous;
    const savedDevelopment = { ...development,
      updatedAt: new Date(Math.max(Date.now(), (Date.parse(oldDevelopment?.updatedAt) || 0) + 1)).toISOString(),
      progress: oldDevelopment?.version === 1 ? (oldDevelopment.progress || {}) : {} };
    const evaluation = await tx.companyEvaluation.upsert({
      where: { applicationId },
      update: {
        technicalScore: data.technicalScore,
        problemSolvingScore: data.problemSolvingScore,
        communicationScore: data.communicationScore,
        teamworkScore: data.teamworkScore,
        overallFeedback: data.overallFeedback.trim(),
        strengths: data.strengths || [],
        areasForImprovement: savedDevelopment,
      },
      create: {
        applicationId,
        companyId: member.companyId,
        candidateId: application.candidateId,
        technicalScore: data.technicalScore,
        problemSolvingScore: data.problemSolvingScore,
        communicationScore: data.communicationScore,
        teamworkScore: data.teamworkScore,
        overallFeedback: data.overallFeedback.trim(),
        strengths: data.strengths || [],
        areasForImprovement: savedDevelopment,
      },
    });
    const candidate = await tx.candidateProfile.findUnique({ where: { id: application.candidateId }, select: { userId: true } });
    if (!candidate) throw new NotFoundException('Candidate profile not found');
    await tx.notification.create({ data: {
      userId: candidate.userId, type: 'SYSTEM_ANNOUNCEMENT',
      title: previous ? 'บริษัทแก้ไขผลประเมินและแผนพัฒนา' : 'ได้รับผลประเมินและแผนพัฒนาจากบริษัท',
      message: `มีผลประเมินสำหรับ ${application.job.title} เปิดอ่านข้อเสนอแนะและแผนการเรียนรู้ของคุณ`,
      link: `/learning-plan#evaluation-${evaluation.id}`,
      metadata: { kind: 'COMPANY_EVALUATION', evaluationId: evaluation.id, action: previous ? 'UPDATED' : 'CREATED' },
    } });
    return evaluation;
    });
  }

  async getCandidateEvaluations(candidateUserId: string) {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId: candidateUserId },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found');

    return this.prisma.companyEvaluation.findMany({
      where: { candidateId: candidate.id },
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
        application: {
          include: { job: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
