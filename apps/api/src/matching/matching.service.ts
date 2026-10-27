import { skillAttemptSelect } from '../assessments/skill-attempt-select';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchScoreResult, assessmentMatch } from '@smartcareer/shared';

@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  private attempts(candidateId: string) {
    return this.prisma.assessmentAttempt.findMany({
      where: { candidateId, status: 'COMPLETED', assessment: { companyId: null } },
      select: skillAttemptSelect,
    });
  }

  async calculateMatchScore(candidateId: string, jobId: string): Promise<MatchScoreResult> {
    const [attempts, job] = await Promise.all([
      this.attempts(candidateId),
      this.prisma.job.findUnique({ where: { id: jobId }, include: { skills: { include: { skill: true } } } }),
    ]);
    if (!job) throw new NotFoundException('Job not found');
    return assessmentMatch(job, attempts);
  }

  async calculateBatchMatchScores(candidateId: string, jobs: any[]): Promise<Map<string, MatchScoreResult>> {
    if (!jobs?.length) return new Map();
    const attempts = await this.attempts(candidateId);
    return new Map(jobs.map(job => [job.id, assessmentMatch(job, attempts)]));
  }
}
