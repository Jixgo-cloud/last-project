import { AttemptScoreInput, getAttemptPercentage } from './assessment-score';

type CodingAttempt = AttemptScoreInput & { id: string; assessmentId: string; startedAt: string | Date; assessment?: { type?: string; title?: string } };
/** Latest graded coding result. Assigned/job-specific coding exams take precedence. */
export function codingScreeningResult(attempts: CodingAttempt[], assessment?: { id: string; type?: string } | null) {
  const eligible = attempts.filter(a => a.assessment?.type === 'PRACTICAL_CODING' &&
    (!assessment || assessment.type !== 'PRACTICAL_CODING' || a.assessmentId === assessment.id) && getAttemptPercentage(a) !== null)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime() || a.id.localeCompare(b.id));
  const latest = eligible[0];
  return latest ? { percentage: getAttemptPercentage(latest)!, assessmentTitle: latest.assessment?.title || '', attemptId: latest.id } : null;
}

export function filterCodingApplications<T extends { codingResult?: { percentage: number } | null }>(apps: T[], minimum: string, order: string) {
  const filtered = apps.filter(a => minimum === '' || (minimum === 'NONE' ? !a.codingResult :
    a.codingResult != null && a.codingResult.percentage >= Number(minimum)));
  if (order === 'ASC' || order === 'DESC') filtered.sort((a, b) => {
    if (!a.codingResult) return b.codingResult ? 1 : 0;
    if (!b.codingResult) return -1;
    return (a.codingResult.percentage - b.codingResult.percentage) * (order === 'ASC' ? 1 : -1);
  });
  return filtered;
}

/** Evidence strength, not proficiency. Repeated repos, stars and exams never add points. */
export function githubEvidenceScore(skill: { evidences?: { repositoryId?: string | null; scoreContribution?: number }[] }) {
  const weights = (skill.evidences || []).filter(e => e.repositoryId && typeof e.scoreContribution === 'number' && Number.isFinite(e.scoreContribution) && e.scoreContribution > 0).map(e => e.scoreContribution!);
  return weights.length ? Math.min(95, 60 + Math.max(...weights)) : 0;
}

/** Compatibility alias for radar callers; exams are deliberately excluded. */
export const evidenceWeightedScore = githubEvidenceScore;

/** Normalize legacy combined caches without rewriting historical exam records. */
export function githubSkillView<T extends { evidences?: { repositoryId?: string | null; scoreContribution?: number }[] }>(skill: T) {
  const score = githubEvidenceScore(skill);
  return { ...skill, practicalScore: score, verifiedScore: score, hasGithubEvidence: score > 0, scoreSource: 'GITHUB_EVIDENCE' as const };
}
