import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException, Logger, HttpException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { ApplicationStatus, applicationAssessmentView, UserRole } from '@smartcareer/shared';
import { companyEvaluationView } from '../evaluations/company-evaluation-view';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private prisma: PrismaService,
    private matchingService: MatchingService,
  ) {}

  async applyJob(
    candidateUserId: string,
    jobId: string,
    data: { coverLetter?: string; resumeUrl?: string },
  ) {
    try {
      const candidate = await this.prisma.candidateProfile.findUnique({
        where: { userId: candidateUserId },
      });
      if (!candidate) throw new NotFoundException('Candidate profile not found');

    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    if (!job.isActive || (job.expiresAt && new Date(job.expiresAt) <= new Date())) {
      throw new BadRequestException('ตำแหน่งงานนี้ปิดรับสมัครแล้ว (This job application has closed)');
    }

    const latestApplication = await this.prisma.jobApplication.findFirst({
      where: {
        jobId,
        candidateId: candidate.id,
      },
      orderBy: { roundNumber: 'desc' },
    });

    if (latestApplication) {
      if (
        latestApplication.status !== ApplicationStatus.CANCELLED &&
        latestApplication.status !== ApplicationStatus.REJECTED
      ) {
        throw new ConflictException('You have already applied for this job');
      }
    }

    const nextRound = latestApplication ? latestApplication.roundNumber + 1 : 1;

    // Calculate snapshot of match score at application
    const match = await this.matchingService.calculateMatchScore(candidate.id, jobId);

    const application = await this.prisma.jobApplication.create({
      data: {
        jobId,
        candidateId: candidate.id,
        roundNumber: nextRound,
        status: ApplicationStatus.APPLIED,
        coverLetter: data.coverLetter,
        resumeUrl: data.resumeUrl,
        matchScoreAtApplication: match.matchScore,
        matchAssessmentSnapshot: { ...match, policyVersion: 1 },
        statusHistory: {
          create: {
            newStatus: ApplicationStatus.APPLIED,
            note: nextRound > 1 ? `Application re-submitted by candidate (Round ${nextRound})` : 'Application submitted by candidate',
          },
        },
      },
      include: {
        job: true,
        statusHistory: true,
      },
    });

      return applicationAssessmentView(application);
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      // Prisma errors can contain submitted cover letters or other private fields.
      this.logger.error('Application submission failed');
      throw new InternalServerErrorException('Application submission failed');
    }
  }

  async cancelApplication(candidateUserId: string, applicationId: string) {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId: candidateUserId },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found');

    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) throw new NotFoundException('Application not found');

    if (application.candidateId !== candidate.id) {
      throw new ForbiddenException('You are not authorized to cancel this application');
    }

    if (application.status === ApplicationStatus.CANCELLED) {
      throw new BadRequestException('Application is already cancelled');
    }

    if (application.status === ApplicationStatus.ACCEPTED || application.status === ApplicationStatus.REJECTED) {
      throw new BadRequestException(`Cannot cancel application in status ${application.status}`);
    }

    const updated = await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.CANCELLED,
        statusHistory: {
          create: {
            previousStatus: application.status,
            newStatus: ApplicationStatus.CANCELLED,
            note: 'Application cancelled by candidate',
          },
        },
      },
      include: {
        job: true,
        statusHistory: true,
      },
    });

    return applicationAssessmentView(updated);
  }

  async getApplicationById(id: string, userId: string, role: UserRole) {
    if (!userId || ![UserRole.CANDIDATE, UserRole.COMPANY, UserRole.ADMIN].includes(role)) {
      throw new NotFoundException('Application not found');
    }
    const scope = role === UserRole.ADMIN ? {} : role === UserRole.CANDIDATE
      ? { candidate: { userId } }
      : { job: { company: { members: { some: { userId } } } } };
    const application = await this.prisma.jobApplication.findFirst({
      where: { id, ...scope },
      include: {
        job: { include: { company: true } },
        candidate: {
          include: {
            user: { select: { id: true, email: true, avatarUrl: true } },
            skills: { include: { skill: true } },
          },
        },
        evaluation: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return applicationAssessmentView({ ...application,
      evaluation: role === UserRole.COMPANY && application.evaluation
        ? companyEvaluationView(application.evaluation) : application.evaluation,
    });
  }
}
