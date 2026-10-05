import { AssessmentReviewStatus, QuestionEvaluationMethod } from '@smartcareer/shared';

/** Aggregate the whole attempt, including an unresolved rubric answer. */
export function codingAttemptTotals(assessment: any, answers: any[], isExpired: boolean,
  previousReviewStatus?: string, currentEvaluationMethod?: string) {
  const maxScore = assessment.questions.reduce((sum: number, q: any) => sum + q.points, 0);
  const pending = answers.some(a => a.executionResult?.evaluationPending === true) ||
    (previousReviewStatus === AssessmentReviewStatus.EVALUATION_PENDING &&
      currentEvaluationMethod !== QuestionEvaluationMethod.OPEN_ENDED &&
      answers.some(a => a.executionResult?.evaluationPending === undefined));
  const hasRubricAnswer = assessment.questions.some((q: any) =>
    q.evaluationMethod === QuestionEvaluationMethod.OPEN_ENDED && answers.some(a => a.questionId === q.id));
  const needsHumanReview = Boolean(assessment.companyId) && hasRubricAnswer;
  const score = pending ? null : isExpired ? 0 : answers.reduce((sum, a) => sum + a.pointsEarned, 0);
  const percentage = score === null ? null : maxScore > 0 ? Math.round(score / maxScore * 100) : 0;
  return {
    score, maxScore, percentage,
    passed: percentage === null ? null : !isExpired && percentage >= assessment.passingScore,
    aiScore: percentage,
    finalScore: needsHumanReview ? null : percentage,
    reviewStatus: pending ? AssessmentReviewStatus.EVALUATION_PENDING : needsHumanReview
      ? AssessmentReviewStatus.PENDING_HUMAN_REVIEW : AssessmentReviewStatus.NOT_REQUIRED,
  };
}
