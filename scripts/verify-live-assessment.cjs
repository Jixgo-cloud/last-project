// Live local API -> real configured Judge0 -> PostgreSQL -> matching/recommendations.
// Run only against the clone produced by upgrade-assessment-database.cjs.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const bank = require('../prisma/assessment-bank/javascript-sandbox.json');
const file = path.join(os.homedir(), '.codex/smartcareer-live-qa.json');
const cfg = JSON.parse(fs.readFileSync(file));
assert(new URL(cfg.databaseUrl).pathname.startsWith('/smartcareer_live_judge_'));
const db = new PrismaClient({ datasources: { db: { url: cfg.databaseUrl } } });
const stage = process.argv[2] || 'before';
assert(['before', 'gap', 'pass'].includes(stage));
const userKey = process.argv.includes('--gap-user') ? 'gapTestUser' : 'testUser';
let testUser = cfg[userKey];
async function request(route, body) {
  const r = await fetch('http://localhost:4000/api' + route, {
    method: body ? 'POST' : 'GET', headers: { ...(testUser?.token ? { Authorization: 'Bearer ' + testUser.token } : {}), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(120000),
  });
  const data = await r.json();
  assert(r.ok, `${route}: HTTP ${r.status} ${JSON.stringify(data)}`);
  return data;
}
(async () => {
  if (!testUser) {
    const suffix = userKey === 'gapTestUser' ? '-gap' : '';
    const auth = await request('/auth/dev-callback', { provider: 'github', role: 'CANDIDATE',
      email: `live-judge-qa${suffix}@smartcareer.test`, fullName: 'Live Judge QA' + suffix, githubUsername: 'smartcareer-live-qa' + suffix });
    testUser = cfg[userKey] = { id: auth.id, email: auth.email, token: auth.token, candidateId: auth.candidateProfile.id };
  }
  const a = await db.assessment.findUniqueOrThrow({ where: { slug: 'coding-algorithm-sandbox' }, include: { questions: true } });
  cfg.assessmentId = a.id;
  if (!cfg.jobId) {
    const job = await db.job.findFirstOrThrow({ where: { title: 'Full Stack Developer (Next.js / .NET / Java)', isActive: true } });
    cfg.jobId = job.id;
  }
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  const report = { stage, checkedAt: new Date().toISOString(), assessmentId: a.id, bankVersion: a.version };
  const examRoute = '/assessments/' + a.id;
  const candidateExam = await request(examRoute);
  assert(candidateExam.questions.every(q => q.solutionCode === undefined &&
    q.testCases.filter(tc => tc.isHidden).every(tc => tc.input === undefined && tc.expectedOutput === undefined)),
    'Candidate API must not expose reference solutions or hidden cases');
  if (stage === 'gap' && !process.argv.includes('--check-only')) {
    const at = await request(examRoute + '/start', {});
    cfg.attemptId = at.id;
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
    report.attemptId = at.id;
    report.submissions = [];
    // Correct first task, intentionally wrong second task: known 50/100 result.
    for (const expected of bank.questions) {
      const q = a.questions.find(q => q.title === expected.title);
      const sourceCode = q.title.includes('Two Sum') ? expected.solutionCode : "function solution(str) { return 'unimplemented'; }";
      const result = await request(examRoute + '/submit-coding', { attemptId: at.id, questionId: q.id, sourceCode });
      assert.equal(result.execution.engine, 'Judge0-Isolated-Container');
      assert.equal(result.execution.passedTestCases, q.title.includes('Two Sum') ? 5 : 0);
      assert(result.execution.details.every(d => typeof d.timeMs === 'number'));
      assert(result.execution.details.filter(d => d.isHidden).every(d => d.input.includes('(Hidden)') && d.expected === '[Hidden]' && ['[Passed]', '[Failed]'].includes(d.actual)));
      report.submissions.push(result);
    }
    const persisted = await db.assessmentAttempt.findUniqueOrThrow({ where: { id: at.id }, include: { answers: true } });
    assert.equal(persisted.status, 'COMPLETED');
    assert.equal(persisted.percentage, 50);
    assert.equal(persisted.answers.length, 2);
    assert.equal(persisted.snapshot.skillAssessmentVersion, 1);
    report.persisted = { status: persisted.status, percentage: persisted.percentage, snapshot: persisted.snapshot, answers: persisted.answers.length };
  }
  report.match = await request('/jobs/' + cfg.jobId + '/match');
  report.recommendations = await request('/recommendations/skill-gaps');
  report.jobDetail = await request('/jobs/' + cfg.jobId + '/detail');
  report.jobs = await request('/jobs?limit=100');
  report.profile = await request('/candidate/profile');
  const listed = report.jobs.jobs.find(j => j.id === cfg.jobId);
  assert(listed, 'Test vacancy must appear in the listing');
  assert.deepEqual(listed.matchAssessment, report.match, 'Batch and detail matching must agree');
  assert.deepEqual(report.jobDetail.matchScore, report.match);
  report.persistedAttempts = await db.assessmentAttempt.findMany({
    where: { candidateId: testUser.candidateId, assessmentId: a.id },
    orderBy: { startedAt: 'desc' },
    select: { id: true, status: true, percentage: true, passed: true, snapshot: true,
      answers: { select: { questionId: true, pointsEarned: true, executionResult: true } } },
  });
  const js = report.recommendations.assessmentPlan.find(p => p.skillName === 'JavaScript');
  assert(js, 'Job-derived plan must include JavaScript');
  if (stage === 'before') {
    assert.equal(report.match.matchScore, null);
    assert.equal(report.match.status, 'AWAITING_ASSESSMENT');
    assert.equal(report.match.assessedCount, 0);
    assert.equal(js.currentLevel, null);
    assert.equal(js.status, 'NOT_ASSESSED');
    assert.equal(report.recommendations.gaps.length, 0);
  } else {
    const score = stage === 'gap' ? 50 : 100;
    assert.equal(report.match.status, 'PRELIMINARY');
    assert.equal(report.match.assessedCount, 1);
    assert.equal(report.match.totalSkills, 11);
    assert.equal(report.match.unassessedSkills.length, 10);
    assert(report.match.unassessedSkills.every(s => s.userScore === null));
    assert.equal(js.currentLevel, score);
    assert.equal(report.profile.skills.find(s => s.skillId === a.skillId).assessmentScore, score);
    assert.equal(js.status, stage === 'gap' ? 'GAP' : 'ASSESSED');
    if (stage === 'gap') {
      assert.equal(report.recommendations.gaps.length, 1);
      assert.equal(report.recommendations.gaps[0].skillName, 'JavaScript');
      assert(report.recommendations.gaps[0].recommendedCourses.length > 0, 'Measured gap should have courses in this dataset');
      assert(report.recommendations.gaps[0].recommendedCourses.every(c => !c.title.startsWith('HTML5')));
      assert(report.jobDetail.recommendedCourses.every(c => !c.title.startsWith('HTML5')), 'Stale HTML-only tags must not close a JavaScript gap');
    } else {
      assert.equal(report.match.matchScore, 100);
      assert.equal(report.recommendations.gaps.length, 0);
      assert.equal(report.jobDetail.recommendedCourses.length, 0);
      const latest = report.persistedAttempts[0];
      assert.equal(latest.status, 'COMPLETED');
      assert.equal(latest.percentage, 100);
      assert.equal(latest.answers.length, 2);
      assert(latest.answers.every(answer => answer.executionResult.engine === 'Judge0-Isolated-Container' &&
        answer.executionResult.passedTestCases === answer.executionResult.totalTestCases));
    }
  }
  const out = path.join(path.dirname(cfg.reportPath), 'live-api-' + stage + '.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ stage, passed: true, matchScore: report.match.matchScore,
    coverage: `${report.match.assessedCount}/${report.match.totalSkills}`, assessedJavaScript: js.currentLevel,
    gaps: report.recommendations.gaps.map(g => ({ skill: g.skillName, courses: g.recommendedCourses.length })), report: out }));
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
