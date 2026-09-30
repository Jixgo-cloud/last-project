import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
    },
  ) {
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

    const evaluation = await this.prisma.companyEvaluation.upsert({
      where: { applicationId },
      update: {
        technicalScore: data.technicalScore,
        problemSolvingScore: data.problemSolvingScore,
        communicationScore: data.communicationScore,
        teamworkScore: data.teamworkScore,
        overallFeedback: data.overallFeedback,
        strengths: data.strengths || [],
        areasForImprovement: data.areasForImprovement || [],
      },
      create: {
        applicationId,
        companyId: member.companyId,
        candidateId: application.candidateId,
        technicalScore: data.technicalScore,
        problemSolvingScore: data.problemSolvingScore,
        communicationScore: data.communicationScore,
        teamworkScore: data.teamworkScore,
        overallFeedback: data.overallFeedback,
        strengths: data.strengths || [],
        areasForImprovement: data.areasForImprovement || [],
      },
    });

    return evaluation;
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
