export type AttemptScoreInput = {
  status?: string | null;
  reviewStatus?: string | null;
  humanScore?: number | null;
  finalScore?: number | null;
  percentage?: number | null;
  score?: number | null;
  maxScore?: number | null;
};

/** Raw points are never percentages. Unfinished and unreviewed attempts have no final result. */
export function getAttemptPercentage(attempt: AttemptScoreInput): number | null {
  if (attempt.status && !['COMPLETED', 'EXPIRED'].includes(attempt.status)) return null;
  if (['EVALUATION_PENDING', 'EVALUATION_FAILED', 'PENDING_HUMAN_REVIEW'].includes(attempt.reviewStatus || '')) return null;
  const bounded = (value: number) => Math.round(Math.max(0, Math.min(100, value)));
  for (const value of [attempt.humanScore, attempt.finalScore, attempt.percentage]) {
    if (typeof value === 'number' && Number.isFinite(value)) return bounded(value);
  }
  if (typeof attempt.score === 'number' && Number.isFinite(attempt.score) &&
      typeof attempt.maxScore === 'number' && Number.isFinite(attempt.maxScore) && attempt.maxScore > 0) {
    return bounded(attempt.score / attempt.maxScore * 100);
  }
  return null;
}

export function formatAttemptScore(attempt: AttemptScoreInput): string {
  const percentage = getAttemptPercentage(attempt);
  return percentage === null ? 'รอตรวจ' : `${percentage}%`;
}

/** Reopening an exam shows its latest finished result; an active round must resume. */
export function getLatestFinishedAttempt<T extends { assessmentId: string; status: string; startedAt: string | Date }>(
  attempts: T[], assessmentId: string,
): T | null {
  const latest = attempts.filter(attempt => attempt.assessmentId === assessmentId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
  return latest && ['COMPLETED', 'EXPIRED'].includes(latest.status) ? latest : null;
}
