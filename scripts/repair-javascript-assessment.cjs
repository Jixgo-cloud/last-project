// Version the existing two-question bank without deleting attempts or answers.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const { PrismaClient } = require('@prisma/client');
const bank = require('../prisma/assessment-bank/javascript-sandbox.json');
const env = { ...require('dotenv').parse(fs.readFileSync('.env')), ...require('dotenv').parse(fs.readFileSync('apps/api/.env')), ...process.env };
const qa = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.codex/smartcareer-live-qa.json')));
const databaseUrl = process.argv.includes('--qa') ? qa.databaseUrl : env.DATABASE_URL;
const url = new URL(databaseUrl);
assert(['localhost', '127.0.0.1'].includes(url.hostname), 'Only local databases are supported');
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
(async () => {
  const a = await db.assessment.findUniqueOrThrow({ where: { slug: 'coding-algorithm-sandbox' }, include: { questions: true } });
  assert.equal(a.companyId, null);
  assert.equal(a.questions.length, 2, 'Unexpected bank; review manually');
  assert(a.questions.every(q => bank.questions.some(b => b.title === q.title)), 'Unexpected bank; review manually');
  const isCurrent = a.version === bank.version && bank.questions.every(b => {
    const q = a.questions.find(q => q.title === b.title);
    return Object.keys(b).every(k => isDeepStrictEqual(q[k], b[k]));
  });
  if (isCurrent) { console.log('Bank already repaired'); return; }
  assert.equal(a.version, 1, 'A newer bank exists; do not overwrite editorial changes');
  const backup = path.join(path.dirname(qa.reportPath), `bank-before-${url.pathname.slice(1)}-${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify(a, null, 2), { flag: 'wx' });
  const counts = [await db.assessmentAttempt.count(), await db.assessmentAnswer.count()];
  await db.$transaction(async tx => {
    for (const b of bank.questions) {
      const q = a.questions.find(q => q.title === b.title);
      await tx.question.update({ where: { id: q.id }, data: { ...b, version: bank.version } });
    }
    await tx.assessment.update({ where: { id: a.id }, data: { version: bank.version, description: bank.description } });
  });
  assert.deepEqual([await db.assessmentAttempt.count(), await db.assessmentAnswer.count()], counts);
  console.log(JSON.stringify({ database: url.pathname.slice(1), assessmentId: a.id, version: bank.version, questions: 2, preservedAttempts: counts[0], preservedAnswers: counts[1], backup }));
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
