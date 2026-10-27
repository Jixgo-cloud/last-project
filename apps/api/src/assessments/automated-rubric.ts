import { BadRequestException } from '@nestjs/common';

/** Opt-in versioned rubric. Legacy banks retain proportional test-case scoring. */
export function automatedRubricScore(points: number, cases: any[], details: { passed: boolean }[], rubric: any) {
  if (details.length !== cases.length || !cases.length) throw new BadRequestException('Incomplete execution report');
  const passed = details.filter(d => d.passed).length;
  if (rubric?.model !== 'CRITERION_GATE_V1') {
    return { pointsEarned: Math.round(passed / cases.length * points * 10) / 10 };
  }
  const criteria = rubric.criteria;
  if (!Array.isArray(criteria) || !criteria.length || new Set(criteria.map(c => c.id)).size !== criteria.length ||
      criteria.some(c => !c.id || !Number.isFinite(c.weight) || c.weight <= 0) ||
      cases.some(tc => !criteria.some(c => c.id === tc.criterionId)) ||
      !Number.isFinite(rubric.essentialFailureCap) || rubric.essentialFailureCap < 0 || rubric.essentialFailureCap > 1) {
    throw new BadRequestException('Invalid criterion rubric');
  }
  const results = criteria.map(c => {
    const indices = cases.flatMap((tc, i) => tc.criterionId === c.id ? [i] : []);
    if (!indices.length) throw new BadRequestException('Criterion has no test cases');
    return { id: c.id, weight: c.weight, essential: c.essential === true, passed: indices.every(i => details[i].passed) };
  });
  const weight = results.reduce((s, c) => s + c.weight, 0);
  const fraction = results.reduce((s, c) => s + (c.passed ? c.weight : 0), 0) / weight;
  const capped = results.some(c => c.essential && !c.passed);
  return { pointsEarned: Math.round(points * Math.min(fraction, capped ? rubric.essentialFailureCap : 1) * 10) / 10,
    rubricResult: { model: rubric.model, criteria: results, essentialCapApplied: capped } };
}
