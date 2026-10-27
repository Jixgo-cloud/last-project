const test = require('node:test');
const assert = require('node:assert/strict');
const { applicationAssessmentResult } = require('../packages/shared/dist');

const exam = (id, passingScore = 70) => ({ id, title: id, passingScore, type: 'THEORY' });
const attempt = (id, assessmentId, percentage, extra = {}) => ({
  id, assessmentId, percentage, status: 'COMPLETED', startedAt: '2026-10-27T08:00:00Z', ...extra,
});
const fixture = () => ({
  assignedAssessmentId: 'personal', assignedAssessment: exam('personal', 85),
  job: { customAssessmentId: 'default', customAssessment: exam('default') },
  candidate: { assessmentAttempts: [attempt('default-result', 'default', 100), attempt('personal-result', 'personal', 80)] },
});

test('assigned exam overrides job default, including its threshold', () => {
  const result = applicationAssessmentResult(fixture());
  assert.equal(result.assessment.id, 'personal');
  assert.equal(result.percentage, 80);
  assert.equal(result.passingScore, 85);
  assert.equal(result.passed, false);
});
test('job default is used only when there is no assignment', () => {
  const app = fixture(); delete app.assignedAssessmentId; delete app.assignedAssessment;
  assert.equal(applicationAssessmentResult(app).percentage, 100);
  delete app.job;
  assert.equal(applicationAssessmentResult(app), null);
});
test('assigned exam works without a job default and preserves a zero threshold', () => {
  const app = fixture(); delete app.job; app.assignedAssessment.passingScore = 0;
  const result = applicationAssessmentResult(app);
  assert.equal(result.passingScore, 0); assert.equal(result.passed, true);
});
test('missing assigned metadata or attempts never falls back to a different exam result', () => {
  const app = fixture(); app.candidate.assessmentAttempts.pop();
  assert.equal(applicationAssessmentResult(app).attempt, null);
  assert.equal(applicationAssessmentResult(app).passed, null);
  app.assignedAssessment = null;
  assert.equal(applicationAssessmentResult(app), null);
});
test('latest round is selected regardless of input order; pending is neither pass nor fail', () => {
  for (const extra of [{ status: 'IN_PROGRESS' }, { reviewStatus: 'PENDING_HUMAN_REVIEW' }, { reviewStatus: 'EVALUATION_FAILED' }]) {
    const app = fixture();
    app.candidate.assessmentAttempts.push(attempt('new', 'personal', 0, { startedAt: '2026-10-27T09:00:00Z', ...extra }));
    const originalOrder = app.candidate.assessmentAttempts.map(a => a.id);
    const result = applicationAssessmentResult(app);
    assert.equal(result.attempt.id, 'new'); assert.equal(result.percentage, null); assert.equal(result.passed, null);
    assert.deepEqual(app.candidate.assessmentAttempts.map(a => a.id), originalOrder);
  }
});
