const test = require('node:test');
const assert = require('node:assert/strict');
const { assessedSkills, assessmentMatch, candidateSkillViews, formatMatchSummary, applicationAssessmentView } = require('@smartcareer/shared');
const { MatchingService } = require('../apps/api/dist/matching/matching.service');
const { RecommendationsService } = require('../apps/api/dist/recommendations/recommendations.service');
const { AssessmentsService } = require('../apps/api/dist/assessments/assessments.service');
const { JobsService } = require('../apps/api/dist/jobs/jobs.service');

function attempt(skillId = 'js', score = 60, extra = {}) {
  return { id: 'attempt-'+skillId, assessmentId: 'exam-'+skillId, status: 'COMPLETED', reviewStatus: 'NOT_REQUIRED',
    percentage: score, startedAt: '2026-10-27T01:00:00Z', completedAt: '2026-10-27T02:00:00Z',
    assessment: { companyId: null }, snapshot: { skillAssessmentVersion: 1, gradingMode: 'PLATFORM_AUTOMATED',
      assessmentType: 'PRACTICAL_CODING', assessmentVersion: 1, criteriaHash: 'test-fixture', passingScore: 70,
      skill: { id: skillId, name: skillId, category: 'FRONTEND' },
      questions: [{ id: 'q', points: 10, evaluationMethod: 'AUTOMATED_TEST_CASES', testCaseCount: 3 }],
    }, ...extra };
}
const requirement = (id, required = true, minimumScore = 80) => ({ skillId: id, skill: { id, name: id, category: "FRONTEND" }, minimumScore, isRequired: required });
const job = { id: 'job', title: 'Frontend Developer', skills: [requirement('js'), requirement('css')] };

test('Versioned bank preserves string arguments and reference answers pass every authored case', () => {
  const bank = require('../prisma/assessment-bank/javascript-sandbox.json');
  const { Judge0Client } = require('../apps/api/dist/assessments/judge0.client');
  const vm = require('node:vm');
  const client = new Judge0Client();
  for (const q of bank.questions) {
    assert.notEqual(q.starterCode, q.solutionCode);
    assert.equal(q.rubric.qualityStatus, 'PENDING_EXPERT_REVIEW_AND_PILOT');
    for (const tc of q.testCases) {
      assert(Array.isArray(JSON.parse(tc.input)), 'Use unambiguous JSON arguments');
      let stdout = '';
      // Only committed, developer-authored fixtures run here, never applicant submissions.
      vm.runInNewContext(client.wrapSourceCode(q.solutionCode, tc.input, 63), {
        console: { log: value => { stdout = String(value); }, error: message => assert.fail(message) }, process: {},
      }, { timeout: 1000 });
      assert.equal(stdout, tc.expectedOutput, q.title + ': ' + tc.input);
    }
  }
});

test('Job course recommendations reject stale skill tags and choose the actually supported gap', async () => {
  const staleLink = { skillId: 'js', relevanceScore: 0.9, skill: { name: 'JavaScript' } };
  const db = {
    job: { findUnique: async () => ({ ...job, companyName: 'Real Company', source: 'INTERNAL' }) },
    candidateProfile: { findUnique: async () => ({ id: 'candidate' }) },
    jobFavorite: { findUnique: async () => null },
    course: { findMany: async () => [
      { id: 'wrong', title: 'HTML5 forms', description: 'HTML semantics', skills: [{ ...staleLink, relevanceScore: 1 }] },
      { id: 'right', title: 'JavaScript fundamentals', description: 'Arrays and strings', skills: [staleLink] },
    ] },
  };
  const service = new JobsService(db, { calculateMatchScore: async () => ({ missingSkills: [{ name: 'JavaScript' }] }) });
  const result = await service.findOne('job', 'user');
  assert.deepEqual(result.recommendedCourses.map(c => c.id), ['right']);
  assert.equal(result.recommendedCourses[0].targetSkill, 'JavaScript');
});

test('No result, measured zero and incomplete coverage have distinct semantics', () => {
  const empty = assessmentMatch(job, []);
  assert.equal(empty.matchScore, null); assert.equal(empty.assessmentCoverage, 0);
  assert.equal(empty.status, 'AWAITING_ASSESSMENT'); assert.equal(empty.missingSkills.length, 0);
  assert.equal(empty.unassessedSkills.length, 2); assert.match(formatMatchSummary(empty), /รอการประเมิน/);
  const zero = assessmentMatch(job, [attempt('js', 0)]);
  assert.equal(zero.matchScore, 0); assert.equal(zero.assessmentCoverage, 50);
  assert.equal(zero.status, 'PRELIMINARY'); assert.equal(zero.missingSkills[0].userScore, 0);
  const partial = assessmentMatch(job, [attempt('js', 80)]);
  assert.equal(partial.matchScore, 100); assert.equal(partial.assessedCount, 1);
  assert.equal(partial.unassessedSkills[0].userScore, null); assert.match(formatMatchSummary(partial), /เบื้องต้น.*1\/2/);
  const complete = assessmentMatch(job, [attempt('js', 80), attempt('css', 40)]);
  assert.equal(complete.matchScore, 75); assert.equal(complete.status, 'ASSESSED');
});

test('No requirements or invalid job criteria cannot manufacture a score', () => {
  assert.equal(assessmentMatch({ id: 'empty', skills: [] }, [attempt()]).matchScore, null);
  for (const minimum of [0, -1, 101, NaN]) {
    const result = assessmentMatch({ id: 'bad', skills: [requirement('js', true, minimum)] }, [attempt()]);
    assert.equal(result.matchScore, null); assert.equal(result.unassessedSkills[0].reason, 'INVALID_JOB_CRITERION');
  }
});

test('Absent required or preferred groups do not contribute 100; only measured groups get weight', () => {
  assert.equal(assessmentMatch({ id: 'pref', skills: [requirement('js', false)] }, [attempt('js', 40)]).matchScore, 50);
  const both = assessmentMatch({ id: 'mix', skills: [requirement('js'), requirement('css', false)] }, [attempt('js', 80), attempt('css', 0)]);
  assert.equal(both.matchScore, 78);
});

test('Expired, pending, failed, unbound legacy and company results do not become portable skill results', () => {
  for (const change of [{ status: 'EXPIRED' }, { status: 'IN_PROGRESS' }, { status: 'SYSTEM_ERROR' },
    { reviewStatus: 'PENDING_HUMAN_REVIEW' }, { reviewStatus: 'EVALUATION_PENDING' }, { reviewStatus: 'EVALUATION_FAILED' },
    { snapshot: {} }, { snapshot: null }, { assessment: { companyId: 'private' } }]) {
    assert.equal(assessedSkills([attempt('js', 100, change)]).size, 0);
  }
  const theory = attempt(); theory.snapshot.assessmentType = 'THEORY';
  assert.equal(assessedSkills([theory]).size, 0);
  const open = attempt(); open.snapshot.questions[0].evaluationMethod = 'OPEN_ENDED';
  assert.equal(assessedSkills([open]).size, 0);
  assert.equal(assessedSkills([{ ...open, reviewStatus: 'HUMAN_REVIEWED', humanScore: 72 }]).get('js').score, 72);
});

test('Latest eligible result wins over historic best; later pending attempts do not erase results', () => {
  const older = attempt('js', 100, { id: 'old', completedAt: '2026-10-26' });
  const latest = attempt('js', 30);
  const pending = attempt('js', 100, { id: 'pending', status: 'IN_PROGRESS', completedAt: '2026-10-28' });
  const results = assessedSkills([older, latest, pending]);
  assert.equal(results.get('js').score, 30); assert.equal(results.get('js').status, 'GAP');
  assert.equal(results.get('js').attemptId, latest.id);
});

test('GitHub presence, missing GitHub, stale numeric caches and genuine results stay separate', () => {
  const legacy = { skillId: 'js', skill: { id: 'js', name: 'js', category: 'FRONTEND' }, practicalScore: 85,
    verifiedScore: 100, codingScore: 100, evidences: [{ repositoryId: 'tiny', scoreContribution: 25 }] };
  const view = candidateSkillViews([legacy])[0];
  assert.equal(view.assessmentScore, null); assert.equal(view.practicalScore, null);
  assert.equal(view.hasGithubEvidence, true); assert.equal(view.assessmentStatus, 'NOT_ASSESSED');
  assert.equal(legacy.practicalScore, 85);
  assert.equal(candidateSkillViews([], [attempt('js', 0)])[0].assessmentScore, 0);
});

test('Single and batch API matching use the same evidence and return full coverage', async () => {
  const service = new MatchingService({ assessmentAttempt: { findMany: async () => [attempt()] }, job: { findUnique: async () => job } });
  assert.deepEqual((await service.calculateBatchMatchScores('candidate', [job])).get(job.id), await service.calculateMatchScore('candidate', job.id));
});

test('Recommendations use active job demand and return exams before courses for unknown skills', async () => {
  let courseQueries = 0;
  const service = new RecommendationsService({ candidateProfile: { findUnique: async () => ({ id: 'c', targetCareer: 'Frontend Developer' }) },
    assessmentAttempt: { findMany: async () => [attempt('js', 0)] },
    job: { findMany: async () => [{ ...job, companyName: 'Real company' }, { ...job, id: 'other', title: 'Backend Developer', companyName: 'Other', skills: [requirement('go')] }] },
    assessment: { findMany: async () => [] },
    course: { findMany: async () => { courseQueries++; return []; } },
  });
  const result = await service.getSkillGapsAndRecommendations('user');
  assert.equal(result.relevantJobCount, 1); assert.equal(result.gaps.length, 1);
  assert.equal(result.gaps[0].currentLevel, 0); assert.equal(result.gaps[0].gap, 80);
  assert.equal(result.unassessedSkills.length, 1); assert.equal(result.unassessedSkills[0].skillId, 'css');
  assert.equal(result.unassessedSkills[0].currentLevel, null); assert.equal(courseQueries, 1);
});

test('Historic application scores stay in storage but cannot masquerade as assessment scores', () => {
  const old = { matchScoreAtApplication: 85, matchAssessmentSnapshot: null };
  assert.equal(applicationAssessmentView(old).matchScoreAtApplication, null); assert.equal(old.matchScoreAtApplication, 85);
  const result = assessmentMatch(job, [attempt()]);
  assert.equal(applicationAssessmentView({ matchScoreAtApplication: 85, matchAssessmentSnapshot: { ...result, policyVersion: 1 } }).matchScoreAtApplication, 75);
});

test('Assessment criteria hash is stable across query order and detects rubric/test changes', () => {
  const service = new AssessmentsService({}, {}, {});
  const exam = { skillId: 'js', version: 1, questions: [{ id: 'a', points: 10, testCases: [{ input: '1', expectedOutput: '2' }], choices: [] }, { id: 'b', points: 20, choices: [] }] };
  const hash = service.criteriaHash(exam);
  assert.equal(service.criteriaHash({ ...exam, questions: [...exam.questions].reverse() }), hash);
  assert.notEqual(service.criteriaHash({ ...exam, skillId: 'css' }), hash);
  exam.questions[0].testCases[0].expectedOutput = '3';
  assert.notEqual(service.criteriaHash(exam), hash);
});

test('Run Code never falls back to hidden cases when no visible case exists', async () => {
  let executed = false;
  const service = new AssessmentsService({ candidateProfile: { findUnique: async () => ({ id: 'c' }) } }, { execute: async () => { executed = true; } }, {});
  service.validateAttemptOwnership = async () => ({ assessmentId: 'exam', status: 'IN_PROGRESS', startedAt: new Date(),
    assessment: { type: 'PRACTICAL_CODING', timeLimitMinutes: 30, questions: [{ id: 'q', testCases: [{ input: 'secret', expectedOutput: 'secret', isHidden: true }] }] } });
  await assert.rejects(service.testRunCode('exam', 'a', 'q', 'user', 'function solution() {}'), /ไม่มี test case/);
  assert.equal(executed, false);
});

test('Existing start -> Judge0 grading -> matching path preserves skill and grading provenance', async () => {
  const skill = { id: 'js', name: 'JavaScript', category: 'FRONTEND' };
  const question = { id: 'q', title: 'Fixture arithmetic', prompt: 'Return the sum of two numeric arguments.',
    points: 20, version: 1, difficulty: 'EASY', evaluationMethod: 'AUTOMATED_TEST_CASES',
    starterCode: 'function solution(a, b) { }', rubric: null, choices: [],
    testCases: [{ input: '[1,2]', expectedOutput: '3' }, { input: '[-1,1]', expectedOutput: '0', isHidden: true }] };
  const exam = { id: 'exam', title: 'Fixture assessment', version: 1, type: 'PRACTICAL_CODING', skillId: skill.id,
    skill, companyId: null, isActive: true, timeLimitMinutes: 30, passingScore: 70, questions: [question] };
  let stored, sentLanguage, sentCases; const answers = [];
  const db = {
    candidateProfile: { findUnique: async () => ({ id: 'candidate' }) },
    assessment: { findUnique: async () => exam },
    assessmentAttempt: {
      findFirst: async () => null,
      create: async ({ data }) => { stored = { ...data, id: 'round', startedAt: new Date(), assessment: exam }; return stored; },
      findUnique: async () => ({ ...stored }),
      updateMany: async ({ data }) => { Object.assign(stored, data); return { count: 1 }; },
      update: async ({ data }) => Object.assign(stored, data),
    },
    assessmentAnswer: { findFirst: async () => null, create: async ({ data }) => { answers.push(data); return data; }, findMany: async () => answers },
    candidateSkill: { findUnique: async () => null, upsert: async () => ({}) },
    $transaction: async fn => fn(db),
  };
  const service = new AssessmentsService(db, { execute: async (code, cases, options) => {
    sentLanguage = options.languageId; sentCases = cases;
    return { passedTestCases: 1, totalTestCases: 2, engine: 'JUDGE0', status: 'WRONG_ANSWER', details: [] };
  } }, {});
  await service.startAttempt('exam', 'user');
  assert.equal(stored.snapshot.skill.id, 'js'); assert.equal(stored.snapshot.questions[0].testCaseCount, 2);
  assert.equal(stored.snapshot.questions[0].testCases, undefined);
  assert.equal(stored.snapshot.questions[0].solutionCode, undefined);
  await service.submitCodingSolution('round', 'q', 'user', 'function solution(a,b) { return a+b; } // def notPython');
  assert.equal(sentLanguage, 63, 'candidate text must not switch JavaScript exam to Python');
  assert.equal(sentCases.length, 2); assert.equal(stored.status, 'COMPLETED');
  assert.equal(assessedSkills([stored]).get('js').score, 50);
  const result = assessmentMatch(job, [stored]);
  assert.equal(result.matchScore, 63); assert.equal(result.status, 'PRELIMINARY');
  assert.equal(result.missingSkills[0].attemptId, 'round');
  question.points = 40;
  await assert.rejects(service.validateAttemptOwnership('round', 'user'), /เกณฑ์ข้อสอบเปลี่ยน/);
});
