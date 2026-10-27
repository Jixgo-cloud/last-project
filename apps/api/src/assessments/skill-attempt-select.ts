/** Shared projection: score provenance only, never submitted code or answer keys. */
export const skillAttemptSelect = {
  id: true, assessmentId: true, status: true, reviewStatus: true,
  humanScore: true, finalScore: true, percentage: true, score: true, maxScore: true,
  startedAt: true, completedAt: true, snapshot: true,
  assessment: { select: { companyId: true } },
} as const;
