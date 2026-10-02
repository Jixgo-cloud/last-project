import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchScoreResult } from '@smartcareer/shared';

@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  async calculateMatchScore(candidateId: string, jobId: string): Promise<MatchScoreResult> {
    const [candidate, job] = await Promise.all([
      this.prisma.candidateProfile.findUnique({
        where: { id: candidateId },
        include: {
          skills: {
            include: { skill: true },
          },
        },
      }),
      this.prisma.job.findUnique({
        where: { id: jobId },
        include: {
          skills: {
            include: { skill: true },
          },
        },
      }),
    ]);

    if (!job) {
      throw new Error('Job not found');
    }

    if (!candidate || job.skills.length === 0) {
      return {
        jobId,
        matchScore: 40,
        requiredCoverage: 40,
        preferredCoverage: 0,
        careerAlignment: 10,
        matchedSkills: [],
        missingSkills: job.skills.map((s) => ({
          skillId: s.skillId,
          name: s.skill.name,
          requiredScore: s.minimumScore,
          userScore: 0,
        })),
      };
    }

    const candidateSkillMap = new Map<string, { score: number; isVerified: boolean }>();
    for (const cs of candidate.skills) {
      // Practical score represents hands-on GitHub/project competence (Public Analyzer model)
      // Assessments do not dilute match score; passing grants the Verified Badge
      const effectiveScore = cs.practicalScore || (cs.isVerified ? 85 : 70);
      const isVerified = Boolean(cs.isVerified);
      if (cs.skill?.name) {
        candidateSkillMap.set(cs.skill.name.toLowerCase(), { score: effectiveScore, isVerified });
      }
      if (cs.skillId) {
        candidateSkillMap.set(cs.skillId, { score: effectiveScore, isVerified });
      }
    }

    const requiredSkills = job.skills.filter((s) => s.isRequired);
    const preferredSkills = job.skills.filter((s) => !s.isRequired);

    const matchedSkills: MatchScoreResult['matchedSkills'] = [];
    const missingSkills: MatchScoreResult['missingSkills'] = [];
    let verifiedBadgesCount = 0;

    // 1. Required Skill Coverage (70%)
    let requiredScoreSum = 0;
    if (requiredSkills.length > 0) {
      for (const req of requiredSkills) {
        const skillName = req.skill?.name || 'Skill';
        const skillData =
          (req.skill?.name ? candidateSkillMap.get(req.skill.name.toLowerCase()) : null) ||
          candidateSkillMap.get(req.skillId);
        const userScore = skillData?.score || 0;
        const isVerified = skillData?.isVerified || false;

        if (isVerified) {
          verifiedBadgesCount++;
        }

        const minScore = req.minimumScore || 50;

        if (userScore >= 40) {
          matchedSkills.push({
            skillId: req.skillId,
            name: skillName,
            userScore,
            requiredScore: minScore,
            isVerified,
          });
          requiredScoreSum += Math.min(1, userScore / minScore);
        } else {
          missingSkills.push({
            skillId: req.skillId,
            name: skillName,
            requiredScore: minScore,
            userScore,
          });
        }
      }
    }
    const requiredCoverage =
      requiredSkills.length > 0 ? (requiredScoreSum / requiredSkills.length) * 100 : 100;

    // 2. Preferred Skill Coverage (20%)
    let preferredScoreSum = 0;
    if (preferredSkills.length > 0) {
      for (const pref of preferredSkills) {
        const skillName = pref.skill?.name || 'Skill';
        const skillData =
          (pref.skill?.name ? candidateSkillMap.get(pref.skill.name.toLowerCase()) : null) ||
          candidateSkillMap.get(pref.skillId);
        const userScore = skillData?.score || 0;
        const isVerified = skillData?.isVerified || false;

        if (isVerified) {
          verifiedBadgesCount++;
        }

        const minScore = pref.minimumScore || 50;

        if (userScore >= 30) {
          matchedSkills.push({
            skillId: pref.skillId,
            name: skillName,
            userScore,
            requiredScore: minScore,
            isVerified,
          });
          preferredScoreSum += 1;
        } else {
          missingSkills.push({
            skillId: pref.skillId,
            name: skillName,
            requiredScore: minScore,
            userScore,
          });
        }
      }
    }
    const preferredCoverage =
      preferredSkills.length > 0 ? (preferredScoreSum / preferredSkills.length) * 100 : 100;

    // 3. Career Alignment (10%)
    let careerAlignment = 50; // default 50%
    if (candidate.targetCareer && job.title) {
      const targetWords = candidate.targetCareer.toLowerCase().split(/\s+/);
      const titleWords = job.title.toLowerCase().split(/\s+/);
      const hasCommon = targetWords.some((w) => w.length > 2 && titleWords.some((tw) => tw.includes(w)));
      careerAlignment = hasCommon ? 100 : 40;
    }

    // Weighted Formula: 70% Required + 20% Preferred + 10% Career
    const totalMatchScore = Math.round(
      (requiredCoverage * 0.7) + (preferredCoverage * 0.2) + (careerAlignment * 0.1),
    );

    return {
      jobId,
      matchScore: Math.min(100, Math.max(15, totalMatchScore)),
      requiredCoverage: Math.round(requiredCoverage),
      preferredCoverage: Math.round(preferredCoverage),
      careerAlignment: Math.round(careerAlignment),
      verifiedBadgesCount,
      matchedSkills,
      missingSkills,
    };
  }

  async calculateBatchMatchScores(
    candidateId: string,
    jobs: any[],
  ): Promise<Map<string, number>> {
    const scoreMap = new Map<string, number>();
    if (!jobs || jobs.length === 0) return scoreMap;

    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: {
        skills: {
          include: { skill: true },
        },
      },
    });

    if (!candidate) {
      for (const j of jobs) scoreMap.set(j.id, 0);
      return scoreMap;
    }

    const candidateSkillMap = new Map<string, number>();
    for (const cs of candidate.skills) {
      const effectiveScore = cs.practicalScore || (cs.isVerified ? 85 : 70);
      candidateSkillMap.set(cs.skill.name.toLowerCase(), effectiveScore);
      candidateSkillMap.set(cs.skill.id, effectiveScore);
    }

    for (const job of jobs) {
      if (!job.skills || job.skills.length === 0) {
        scoreMap.set(job.id, 40);
        continue;
      }

      const requiredSkills = job.skills.filter((s: any) => s.isRequired);
      const preferredSkills = job.skills.filter((s: any) => !s.isRequired);

      let requiredScoreSum = 0;
      if (requiredSkills.length > 0) {
        for (const req of requiredSkills) {
          const userScore =
            candidateSkillMap.get(req.skill?.name?.toLowerCase()) ||
            candidateSkillMap.get(req.skillId) ||
            0;
          if (userScore >= 40) {
            requiredScoreSum += Math.min(1, userScore / (req.minimumScore || 50));
          }
        }
      }
      const requiredCoverage =
        requiredSkills.length > 0 ? (requiredScoreSum / requiredSkills.length) * 100 : 100;

      let preferredScoreSum = 0;
      if (preferredSkills.length > 0) {
        for (const pref of preferredSkills) {
          const userScore =
            candidateSkillMap.get(pref.skill?.name?.toLowerCase()) ||
            candidateSkillMap.get(pref.skillId) ||
            0;
          if (userScore >= 30) {
            preferredScoreSum += 1;
          }
        }
      }
      const preferredCoverage =
        preferredSkills.length > 0 ? (preferredScoreSum / preferredSkills.length) * 100 : 100;

      let careerAlignment = 50;
      if (candidate.targetCareer && job.title) {
        const targetWords = candidate.targetCareer.toLowerCase().split(/\s+/);
        const titleWords = job.title.toLowerCase().split(/\s+/);
        const hasCommon = targetWords.some((w: string) => w.length > 2 && titleWords.some((tw: string) => tw.includes(w)));
        careerAlignment = hasCommon ? 100 : 40;
      }

      const totalMatchScore = Math.round(
        (requiredCoverage * 0.7) + (preferredCoverage * 0.2) + (careerAlignment * 0.1),
      );

      scoreMap.set(job.id, Math.min(100, Math.max(15, totalMatchScore)));
    }

    return scoreMap;
  }
}

