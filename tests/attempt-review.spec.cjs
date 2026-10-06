const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync('apps/web/lib/attempt-review.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
new Function('exports', code)(exportsObject);
const { mergeAttemptReview, saveAttemptReview } = exportsObject;

function review(type = 'THEORY') {
  return {
    id: 'qa-attempt', score: 25, maxScore: 50, humanScore: null, finalScore: null,
    assessment: { id: 'qa-exam', type, questions: [{ id: 'q1', choices: [{ id: 'c1', text: 'QA answer', isCorrect: true }] }] },
    candidate: { id: 'qa-person', githubUsername: 'qa-only' },
    answers: [{ questionId: 'q1', selectedChoiceId: 'c1', pointsEarned: 25, submittedCode: 'return a + b;' }],
    snapshot: { questions: [{ id: 'q1', points: 25 }] },
    integritySummary: { tabSwitchCount: 0 },
    evaluationSnapshot: { rubricBreakdown: { functionalCorrectness: { score: 75 } } },
  };
}
function saved(score) {
  return { id: 'qa-attempt', assessment: { id: 'qa-exam', title: 'QA exam' },
    candidate: { id: 'qa-person', fullName: 'QA' }, humanScore: score, finalScore: score,
    percentage: score, passed: score >= 70, reviewStatus: 'HUMAN_REVIEWED',
    reviewedById: 'qa-reviewer', reviewedAt: '2026-10-06T16:00:00Z', reviewReason: 'QA reason' };
}

test('Theory review keeps answers, choices, raw scores and integrity after both full and partial grading', () => {
  for (const score of [100, 50, 0]) {
    const before = review();
    const after = mergeAttemptReview(before, saved(score));
    assert.equal(after.assessment.type, 'THEORY');
    assert.deepEqual(after.assessment.questions, before.assessment.questions);
    assert.deepEqual(after.answers, before.answers);
    assert.deepEqual(after.snapshot, before.snapshot);
    assert.deepEqual(after.integritySummary, before.integritySummary);
    assert.equal(after.score, 25); assert.equal(after.maxScore, 50);
    assert.equal(after.humanScore, score); assert.equal(after.finalScore, score);
    assert.equal(after.passed, score >= 70); assert.equal(after.reviewStatus, 'HUMAN_REVIEWED');
    assert.equal(after.reviewReason, 'QA reason'); assert.equal(after.reviewedById, 'qa-reviewer');
    assert.equal(after.candidate.githubUsername, 'qa-only');
    assert.equal(before.humanScore, null);
  }
});

test('Coding review retains submitted code and AI breakdown after grading', () => {
  const before = review('PRACTICAL_CODING');
  const after = mergeAttemptReview(before, saved(75));
  assert.equal(after.assessment.type, 'PRACTICAL_CODING');
  assert.equal(after.answers[0].submittedCode, 'return a + b;');
  assert.deepEqual(after.evaluationSnapshot, before.evaluationSnapshot);
  assert.equal(after.finalScore, 75);
});

test('A late response cannot overwrite another candidate or a different attempt', () => {
  const current = { ...review(), id: 'another-attempt' };
  assert.equal(mergeAttemptReview(current, saved(100)), current);
});

test('A failed refresh keeps the saved score visible and does not retry the write', async () => {
  let visible = review(); let writes = 0;
  const outcome = await saveAttemptReview(async () => { writes++; return saved(50); },
    updated => { visible = mergeAttemptReview(visible, updated); },
    async () => { assert.equal(visible.finalScore, 50); throw new Error('isolated refresh failure'); });
  assert.deepEqual(outcome, { refreshFailed: true });
  assert.equal(writes, 1); assert.equal(visible.assessment.type, 'THEORY');
  assert.equal(visible.finalScore, 50); assert.equal(visible.answers.length, 1);
});

test('Rejected score saves preserve the original review and never refresh the list', async () => {
  const before = review(); let visible = before; let refreshes = 0;
  await assert.rejects(saveAttemptReview(async () => { throw new Error('permission denied'); },
    updated => { visible = mergeAttemptReview(visible, updated); },
    async () => { refreshes++; }), /permission denied/);
  assert.equal(visible, before); assert.equal(refreshes, 0);
});

test('Successful save updates details before refreshing the list', async () => {
  const events = [];
  const outcome = await saveAttemptReview(async () => { events.push('save'); return saved(100); },
    () => events.push('visible'), async () => { events.push('refresh'); });
  assert.deepEqual(events, ['save', 'visible', 'refresh']);
  assert.deepEqual(outcome, { refreshFailed: false });
});
