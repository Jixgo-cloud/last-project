const test = require('node:test');
const assert = require('node:assert/strict');
const { AssessmentsService } = require('../apps/api/dist/assessments/assessments.service');

function fixture(role = 'ADMIN', archive = true) {
  const old = { version: 1, title: 'Original exam', type: 'PRACTICAL_CODING', passingScore: 70, timeLimitMinutes: 30,
    questions: [{ id: 'q1', title: 'Original task', points: 50, prompt: 'Original prompt', solutionCode: 'private solution', testCases: [{ input: 'private case', isHidden: true }] }] };
  const attempt = { id: 'a1', assessmentId: 'exam', candidateId: 'owner', assessmentVersion: 1, status: 'COMPLETED',
    maxScore: 50, score: 50, percentage: 100, passed: true, snapshot: null,
    answers: [{ questionId: 'q1', pointsEarned: 50 }],
    assessment: { id: 'exam', companyId: null, version: 2, questions: [{ id: 'q1' }, { id: 'q2' }] } };
  const db = { assessmentAttempt: { findUnique: async () => attempt, findMany: async () => [attempt] },
    user: { findUnique: async () => ({ role, companyMembers: [] }) },
    candidateProfile: { findUnique: async () => ({ id: role === 'STRANGER' ? 'stranger' : 'owner' }) },
    assessmentBankRevision: { findUnique: async () => archive ? { snapshot: old } : null } };
  return { service: new AssessmentsService(db, {}, {}), attempt };
}
test('Historical admin review uses one-question archived criteria and unchanged 50/50 result', async () => {
  const { service, attempt } = fixture();
  const result = await service.getAttemptReviewDetails('a1', 'admin');
  assert.equal(result.assessment.version, 1);
  assert.equal(result.assessment.questions.length, 1);
  assert.equal(result.assessment.questions[0].prompt, 'Original prompt');
  assert.equal(result.maxScore, 50); assert.equal(result.percentage, 100);
  assert.deepEqual(result.answers, attempt.answers);
});
test('Candidate historical review/list exposes scope without archive answer keys', async () => {
  const { service } = fixture('CANDIDATE');
  for (const result of [await service.getAttemptReviewDetails('a1', 'owner'), ...(await service.getCandidateAttempts('owner'))]) {
    assert.equal(result.resultScope.questionCount, 1);
    assert.equal(result.resultScope.assessmentVersion, 1);
    assert.equal(result.maxScore, 50); assert.equal(result.percentage, 100);
    assert.equal(result.snapshot, undefined); assert.equal(result.answers, undefined);
    assert.equal(result.assessment.questions, undefined);
    assert(!JSON.stringify(result).includes('private'));
  }
});
test('Missing archive does not present the current questions as historical criteria', async () => {
  const { service } = fixture('ADMIN', false);
  const result = await service.getAttemptReviewDetails('a1', 'admin');
  assert.deepEqual(result.assessment.questions, []);
  assert.equal(result.assessment.historicalCriteriaUnavailable, true);
  assert.equal(result.maxScore, 50);
});
test('Unrelated users cannot read the archive through review', async () => {
  await assert.rejects(fixture('STRANGER').service.getAttemptReviewDetails('a1', 'stranger'), /Access denied/);
});
test('A legacy round without a criteria hash cannot submit against a newer bank', async () => {
  const { service } = fixture('CANDIDATE');
  await assert.rejects(service.validateAttemptOwnership('a1', 'owner'), /เกณฑ์ข้อสอบเปลี่ยน/);
});
