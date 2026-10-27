import { AttemptScoreInput, getAttemptPercentage } from './assessment-score';

type CodingAttempt = AttemptScoreInput & { id: string; assessmentId: string; startedAt: string | Date; assessment?: { type?: string; title?: string } };

type ApplicationAssessment = { id: string; title: string; passingScore?: number | null; type?: string };

/** Keep the evaluation form and pipeline on the same assigned exam and latest round. */
export function applicationAssessmentResult(app: {
  assignedAssessmentId?: string | null;
  assignedAssessment?: ApplicationAssessment | null;
  job?: { customAssessmentId?: string | null; customAssessment?: ApplicationAssessment | null } | null;
  candidate?: { assessmentAttempts?: CodingAttempt[] } | null;
}) {
  const assigned = Boolean(app.assignedAssessmentId || app.assignedAssessment);
  const assessment = assigned ? app.assignedAssessment : app.job?.customAssessment;
  const assessmentId = assigned ? app.assignedAssessmentId || assessment?.id : app.job?.customAssessmentId || assessment?.id;
  // Missing assigned metadata must never silently select a different exam.
  if (!assessment || assessment.id !== assessmentId) return null;
  const attempt = (app.candidate?.assessmentAttempts || [])
    .filter(a => a.assessmentId === assessmentId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime() || a.id.localeCompare(b.id))[0] || null;
  const percentage = attempt ? getAttemptPercentage(attempt) : null;
  const passingScore = assessment.passingScore ?? 70;
  return { assessment, attempt, percentage, passingScore, assigned,
    passed: percentage === null ? null : percentage >= passingScore };
}
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
