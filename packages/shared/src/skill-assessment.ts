import { getAttemptPercentage, AttemptScoreInput } from './assessment-score';
import type { MatchScoreResult } from './index';

export type SkillAssessmentStatus = 'ASSESSED' | 'GAP' | 'NOT_ASSESSED';
type Skill = { id: string; name: string; category: string };
export type SkillAttempt = AttemptScoreInput & {
  id: string; assessmentId: string; startedAt: string | Date; completedAt?: string | Date | null;
  snapshot?: unknown;
  assessment?: { companyId?: string | null; skill?: Skill | null; type?: string; title?: string };
};

/** Latest completed, attributable practical result. Legacy caches and repository data are never inputs. */
export function assessedSkills(attempts: SkillAttempt[] = []) {
  const results = new Map<string, {
    skillId: string; skill: Skill; score: number; requiredScore: number; status: SkillAssessmentStatus;
    attemptId: string; assessmentId: string; assessmentVersion: number; assessedAt: string | Date;
    criteria: unknown; qualityStatus: 'PENDING_EXPERT_REVIEW_AND_PILOT';
  }>();
  const ordered = [...attempts].sort((a, b) =>
    new Date(b.completedAt || b.startedAt).getTime() - new Date(a.completedAt || a.startedAt).getTime() || a.id.localeCompare(b.id));
  for (const attempt of ordered) {
    const snapshot = attempt.snapshot as any;
    if (attempt.status !== 'COMPLETED' || snapshot?.skillAssessmentVersion !== 1 ||
        snapshot.gradingMode !== 'PLATFORM_AUTOMATED' || attempt.assessment?.companyId != null ||
        snapshot.assessmentType !== 'PRACTICAL_CODING' || !snapshot.skill?.id ||
        !snapshot.criteriaHash || !Array.isArray(snapshot.questions) || !snapshot.questions.length ||
        !Number.isFinite(snapshot.passingScore) || snapshot.passingScore <= 0 || snapshot.passingScore > 100) continue;
    if (!snapshot.questions.every((q: any) => q.evaluationMethod === 'AUTOMATED_TEST_CASES' && q.testCaseCount > 0) &&
        attempt.reviewStatus !== 'HUMAN_REVIEWED') continue;
    const score = getAttemptPercentage(attempt);
    if (score === null || results.has(snapshot.skill.id)) continue;
    results.set(snapshot.skill.id, {
      skillId: snapshot.skill.id, skill: snapshot.skill, score, requiredScore: snapshot.passingScore,
      status: score < snapshot.passingScore ? 'GAP' : 'ASSESSED', attemptId: attempt.id,
      assessmentId: attempt.assessmentId, assessmentVersion: snapshot.assessmentVersion,
      assessedAt: attempt.completedAt || attempt.startedAt,
      criteria: { passingScore: snapshot.passingScore, questions: snapshot.questions, hash: snapshot.criteriaHash },
      qualityStatus: 'PENDING_EXPERT_REVIEW_AND_PILOT',
    });
  }
  return results;
}

export function hasGithubEvidence(skill: { evidences?: { repositoryId?: string | null }[] }) {
  return (skill.evidences || []).some(e => !!e.repositoryId);
}

export function formatAssessmentSkill(skill: { assessmentScore?: number | null; assessmentStatus?: string }) {
  if (skill.assessmentScore == null) return 'ยังไม่ประเมิน';
  return `${skill.assessmentScore}% · ${skill.assessmentStatus === 'GAP' ? 'พบช่องว่างจากผลประเมิน' : 'มีผลประเมิน'}`;
}

export function formatMatchSummary(match?: Partial<MatchScoreResult> | null) {
  if (!match || match.scoreSource !== 'ASSESSMENT') return 'ไม่มีผลจับคู่จากการประเมิน (ข้อมูลเดิม)';
  const coverage = `ประเมิน ${match.assessedCount}/${match.totalSkills} ทักษะ (${match.assessmentCoverage}%)`;
  if (match.matchScore == null) return `รอการประเมิน · ${coverage}`;
  return `${match.matchScore}% · ${match.status === 'PRELIMINARY' ? 'คะแนนเบื้องต้น · ' : ''}${coverage}`;
}

export function applicationAssessmentView<T extends { matchScoreAtApplication?: number | null; matchAssessmentSnapshot?: unknown }>(application: T) {
  const snapshot = application.matchAssessmentSnapshot as any;
  return { ...application, matchScoreAtApplication: snapshot?.policyVersion === 1 && snapshot?.scoreSource === 'ASSESSMENT'
    ? snapshot.matchScore ?? null : null };
}

/** Include assessed skills even when a candidate has never connected GitHub. */
export function candidateSkillViews(skills: any[] = [], attempts: SkillAttempt[] = []) {
  const results = assessedSkills(attempts);
  const combined = new Map(skills.map(s => [s.skillId, s]));
  for (const result of results.values()) if (!combined.has(result.skillId)) {
    combined.set(result.skillId, { skillId: result.skillId, skill: result.skill, evidences: [] });
  }
  return [...combined.values()].map(s => {
    const result = results.get(s.skillId);
    return { ...s, practicalScore: null, verifiedScore: null, isVerified: false,
      assessmentScore: result?.score ?? null, assessmentStatus: result?.status ?? 'NOT_ASSESSED',
      assessmentResult: result ?? null, hasGithubEvidence: hasGithubEvidence(s), scoreSource: result ? 'ASSESSMENT' : null };
  });
}

type JobSkill = { skillId: string; minimumScore: number; isRequired: boolean; skill: { name: string } };
/** Only assessed skills enter the denominator. Coverage is always returned alongside the conditional score. */
export function assessmentMatch(job: { id: string; skills: JobSkill[] }, attempts: SkillAttempt[]): MatchScoreResult {
  const results = assessedSkills(attempts);
  const matchedSkills: MatchScoreResult['matchedSkills'] = [];
  const missingSkills: MatchScoreResult['missingSkills'] = [];
  const unassessedSkills: MatchScoreResult['unassessedSkills'] = [];
  const groups = { required: [] as number[], preferred: [] as number[] };
  for (const requirement of job.skills) {
    const result = results.get(requirement.skillId);
    const item = { skillId: requirement.skillId, name: requirement.skill.name, requiredScore: requirement.minimumScore };
    if (!result || !Number.isFinite(requirement.minimumScore) || requirement.minimumScore <= 0 || requirement.minimumScore > 100) {
      unassessedSkills.push({ ...item, userScore: null, status: 'NOT_ASSESSED',
        reason: result ? 'INVALID_JOB_CRITERION' : 'NO_ELIGIBLE_RESULT' });
      continue;
    }
    const measured = { ...item, userScore: result.score, attemptId: result.attemptId };
    if (result.score >= requirement.minimumScore) matchedSkills.push(measured);
    else missingSkills.push(measured);
    groups[requirement.isRequired ? 'required' : 'preferred'].push(Math.min(1, result.score / requirement.minimumScore) * 100);
  }
  const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const required = average(groups.required), preferred = average(groups.preferred);
  const assessedCount = matchedSkills.length + missingSkills.length;
  const weight = (required === null ? 0 : 0.7) + (preferred === null ? 0 : 0.2);
  return { jobId: job.id, matchScore: weight ? Math.round(((required ?? 0) * 0.7 + (preferred ?? 0) * 0.2) / weight) : null,
    status: assessedCount === 0 ? 'AWAITING_ASSESSMENT' : unassessedSkills.length ? 'PRELIMINARY' : 'ASSESSED',
    assessedCount, totalSkills: job.skills.length,
    assessmentCoverage: job.skills.length ? Math.round(assessedCount / job.skills.length * 100) : 0,
    requiredCoverage: required === null ? null : Math.round(required),
    preferredCoverage: preferred === null ? null : Math.round(preferred), careerAlignment: null,
    matchedSkills, missingSkills, unassessedSkills, scoreSource: 'ASSESSMENT',
  };
}
