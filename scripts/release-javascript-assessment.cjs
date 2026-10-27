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
assert(process.env.DATABASE_URL, 'Supply DATABASE_URL through the release secret environment');
const db = new PrismaClient();
const query = { where: { slug: 'coding-algorithm-sandbox' }, include: { skill: true, questions: { orderBy: { id: 'asc' } } } };
const hash = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const current = a => a.version === bank.version && a.description === bank.description && bank.questions.every(b => {
  const q = a.questions.find(q => q.title === b.title);
  return q && Object.keys(b).every(key => isDeepStrictEqual(q[key], b[key]));
});
async function main() {
  const assessment = await db.assessment.findUniqueOrThrow(query);
  assert.equal(assessment.companyId, null, 'Only the platform bank can be patched');
  assert.equal(assessment.type, 'PRACTICAL_CODING');
  assert.equal(assessment.skill?.slug, 'javascript', 'Bank must be bound to JavaScript');
  assert.equal(assessment.questions.length, bank.questions.length);
  assert.equal(new Set(assessment.questions.map(q => q.title)).size, bank.questions.length);
  assert(assessment.questions.every(q => bank.questions.some(b => b.title === q.title)), 'Unknown bank; review manually');
  if (current(assessment)) { console.log(JSON.stringify({ status: 'ALREADY_CURRENT', version: bank.version })); return; }
  assert.equal(assessment.version, 1, 'Unexpected version; do not overwrite editorial changes');
  const fingerprint = hash(assessment);
  console.log(JSON.stringify({ status: apply ? 'APPLYING' : 'PLAN_ONLY', assessmentId: assessment.id, fromVersion: assessment.version, toVersion: bank.version, expectedHash: fingerprint, questionTitles: bank.questions.map(q => q.title), qualityStatus: bank.qualityStatus }));
  if (!apply) return;
  assert(args.includes('--expected-hash') && value('--expected-hash') === fingerprint, 'Plan hash differs; review a fresh plan');
  assert(args.includes('--backup-dir') && path.isAbsolute(value('--backup-dir')), 'Provide an absolute private --backup-dir');
  const backupDir = value('--backup-dir');
  assert(fs.statSync(backupDir).isDirectory(), 'Backup directory must already exist');
  const backupFile = path.join(backupDir, `javascript-bank-before-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(assessment, null, 2), { flag: 'wx', mode: 0o600 });
  await db.$transaction(async tx => {
    const latest = await tx.assessment.findUniqueOrThrow(query);
    assert.equal(hash(latest), fingerprint, 'Bank changed after planning; retry after reviewing it');
    for (const question of bank.questions) {
      await tx.question.update({ where: { id: latest.questions.find(q => q.title === question.title).id }, data: { ...question, version: bank.version } });
    }
    await tx.assessment.update({ where: { id: latest.id }, data: { version: bank.version, description: bank.description } });
  }, { isolationLevel: 'Serializable' });
  assert(current(await db.assessment.findUniqueOrThrow(query)), 'Post-update verification failed');
  console.log(JSON.stringify({ status: 'APPLIED', version: bank.version, backupFile, attemptsAndAnswers: 'UNMODIFIED' }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
