// Explicit release patch. Default is read-only; never loads local QA configuration.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { PrismaClient } = require('@prisma/client');
const bank = require('../prisma/assessment-bank/javascript-sandbox.json');
const args = process.argv.slice(2);
const value = flag => args[args.indexOf(flag) + 1];
const apply = args.includes('--apply');
const expand = args.includes('--expand-single-question');
// Explicit owner-approved exception; the database revision archive is still mandatory.
const skipBackup = args.includes('--skip-backup');
assert(!(skipBackup && args.includes('--backup-dir')), 'Choose --skip-backup or --backup-dir, not both');
assert(process.env.DATABASE_URL, 'Supply DATABASE_URL through the release secret environment');
const db = new PrismaClient();
const query = { where: { slug: 'coding-algorithm-sandbox' }, include: { skill: true, questions: { include: { choices: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } } } };
const hash = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const current = a => a.questions.length === bank.questions.length && a.version === bank.version && a.description === bank.description && bank.questions.every(b => {
  const q = a.questions.find(q => q.title === b.title);
  return q && q.version === bank.version && Object.keys(b).every(key => isDeepStrictEqual(q[key], b[key]));
});
async function main() {
  const assessment = await db.assessment.findUniqueOrThrow(query);
  assert.equal(assessment.companyId, null, 'Only the platform bank can be patched');
  assert.equal(assessment.type, 'PRACTICAL_CODING');
  assert.equal(assessment.skill?.slug, 'javascript', 'Bank must be bound to JavaScript');
  if (current(assessment)) { console.log(JSON.stringify({ status: 'ALREADY_CURRENT', version: bank.version })); return; }
  assert.equal(assessment.version, 1, 'Unexpected version; do not overwrite editorial changes');
  const single = assessment.questions.length === 1;
  if (single) {
    assert(expand, 'One-question bank requires explicit --expand-single-question and a reviewed fresh plan');
    assert.equal(assessment.questions[0].title, 'Two Sum Target Matcher');
    assert.equal(assessment.questions[0].version, 1);
    assert.equal(assessment.questions[0].points, 50);
    assert.equal(assessment.questions[0].evaluationMethod, 'AUTOMATED_TEST_CASES');
    assert.equal(assessment.questions[0].choices.length, 0);
  } else {
    assert.equal(assessment.questions.length, bank.questions.length);
  }
  assert.equal(new Set(assessment.questions.map(q => q.title)).size, assessment.questions.length);
  assert(assessment.questions.every(q => bank.questions.some(b => b.title === q.title)), 'Unknown bank; review manually');
  const fingerprint = hash(assessment);
  console.log(JSON.stringify({ status: apply ? 'APPLYING' : 'PLAN_ONLY', assessmentId: assessment.id, fromVersion: assessment.version, toVersion: bank.version, expectedHash: fingerprint,
    fromQuestionCount: assessment.questions.length, toQuestionCount: bank.questions.length,
    fromMaxPoints: assessment.questions.reduce((sum, q) => sum + q.points, 0), toMaxPoints: bank.questions.reduce((sum, q) => sum + q.points, 0),
    preserves: 'Existing question IDs, attempts, answers, raw scores, denominators, percentages, snapshots and applications',
    questionTitles: bank.questions.map(q => q.title), qualityStatus: bank.qualityStatus }));
  if (!apply) return;
  assert(args.includes('--expected-hash') && value('--expected-hash') === fingerprint, 'Plan hash differs; review a fresh plan');
  let backupFile = null;
  if (!skipBackup) {
    assert(args.includes('--backup-dir') && path.isAbsolute(value('--backup-dir')), 'Provide an absolute private --backup-dir or explicitly authorized --skip-backup');
    const backupDir = value('--backup-dir');
    assert(fs.statSync(backupDir).isDirectory(), 'Backup directory must already exist');
    backupFile = path.join(backupDir, `javascript-bank-before-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(assessment, null, 2), { flag: 'wx', mode: 0o600 });
  }
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15s'");
    // Release window: exclude concurrent exam starts/submissions/editorial writes.
    await tx.$executeRawUnsafe('LOCK TABLE assessments, questions, assessment_attempts, assessment_answers, assessment_bank_revisions IN SHARE ROW EXCLUSIVE MODE');
    const latest = await tx.assessment.findUniqueOrThrow(query);
    assert.equal(hash(latest), fingerprint, 'Bank changed after planning; retry after reviewing it');
    const busy = await tx.assessmentAttempt.count({ where: { assessmentId: latest.id, OR: [
      { status: 'SUBMITTING' },
      { status: 'IN_PROGRESS', startedAt: { gte: new Date(Date.now() - (latest.timeLimitMinutes * 60 + 30) * 1000) } },
      { reviewStatus: { in: ['EVALUATION_PENDING', 'PENDING_HUMAN_REVIEW'] } },
    ] } });
    assert.equal(busy, 0, 'Drain active submissions/attempts and pending reviews before changing the bank');
    // Archive the exact old authored scope; never backfill or rewrite old results.
    await tx.assessmentBankRevision.create({ data: { assessmentId: latest.id, version: latest.version,
      snapshot: JSON.parse(JSON.stringify(latest)), contentHash: fingerprint } });
    for (const question of bank.questions) {
      const existing = latest.questions.find(q => q.title === question.title);
      if (existing) await tx.question.update({ where: { id: existing.id }, data: { ...question, version: bank.version } });
      else await tx.question.create({ data: { ...question, assessmentId: latest.id, version: bank.version } });
    }
    await tx.assessment.update({ where: { id: latest.id }, data: { version: bank.version, description: bank.description } });
  }, { isolationLevel: 'Serializable', timeout: 20000 });
  assert(current(await db.assessment.findUniqueOrThrow(query)), 'Post-update verification failed');
  console.log(JSON.stringify({ status: 'APPLIED', version: bank.version, backupFile, backupSkipped: skipBackup, attemptsAndAnswers: 'UNMODIFIED' }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
