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

/** Missing GitHub evidence cannot contribute a cached practical score. No baseline or bonus. */
export function evidenceWeightedScore(skill: { practicalScore?: number; theoryScore?: number; codingScore?: number; evidences?: { repositoryId?: string | null }[] }) {
  const bounded = (n?: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  const practical = skill.evidences?.some(e => !!e.repositoryId) ? bounded(skill.practicalScore) : 0;
  return practical * 0.5 + bounded(skill.theoryScore) * 0.2 + bounded(skill.codingScore) * 0.3;
}
