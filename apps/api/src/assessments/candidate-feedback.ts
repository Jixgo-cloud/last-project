/** Apply the company's disclosure policy before returning any candidate result. */
export function candidateFeedback<T extends Record<string, any>>(attempt: T, assessment = attempt.assessment): T & { feedbackHidden: boolean } {
  const hidden = Boolean(assessment?.companyId) && (assessment.feedbackVisibility === 'PRIVATE_TO_COMPANY' ||
    (assessment.feedbackVisibility === 'AFTER_REVIEW' && attempt.reviewStatus !== 'HUMAN_REVIEWED'));
  const result: any = { ...attempt };
  // Progress can be restored without disclosing answers or marking details.
  if (Array.isArray(attempt.answers)) {
    result.submittedQuestionIds = [...new Set(attempt.answers.map((answer: any) => answer.questionId).filter((id: unknown) => typeof id === 'string'))];
  }
  // Snapshots and answer details contain marking keys and hidden test inputs.
  delete result.snapshot;
  delete result.assessmentSnapshot;
  delete result.questionSnapshot;
  delete result.answers;
  // Reviewer audit notes and internal identifiers are not candidate-facing feedback.
  delete result.reviewReason;
  delete result.reviewedById;
  if (result.assessment) {
    const { questions, company, ...publicAssessment } = result.assessment;
    result.assessment = { ...publicAssessment, ...(company ? { company: { id: company.id, name: company.name } } : {}) };
  }
  if (hidden) {
    for (const key of ['score', 'totalPointsEarned', 'percentage', 'finalScore', 'humanScore', 'aiScore', 'passed', 'executionResult', 'aiFeedback', 'evaluation', 'evaluationSnapshot', 'execution', 'isCorrect', 'pointsEarned']) result[key] = null;
  }
  result.feedbackHidden = hidden;
  return result;
}
