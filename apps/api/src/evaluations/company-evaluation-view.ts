// Candidate learning journals are private. Company responses contain only
// company-authored feedback, even though both are stored in the same JSON field.
export function companyEvaluationView<T extends { areasForImprovement?: unknown }>(evaluation: T): T {
  if (!evaluation) return evaluation;
  const plan = evaluation.areasForImprovement as any;
  if (plan?.version !== 1) return evaluation;
  return { ...evaluation, areasForImprovement: { version: 1, updatedAt: plan.updatedAt, skillIds: plan.skillIds, note: plan.note } };
}
