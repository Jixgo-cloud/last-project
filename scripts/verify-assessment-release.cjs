// Integration test: creates and removes only its own isolated local database.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const bank = require('../prisma/assessment-bank/javascript-sandbox.json');
const single = process.argv.includes('--single');
const root = path.resolve(__dirname, '..');
const source = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname), 'Requires a local test PostgreSQL server');
const name = `assessment_release_test_${Date.now()}`;
const target = new URL(source); target.pathname = '/' + name;
const admin = new PrismaClient();
const db = new PrismaClient({ datasources: { db: { url: target.href } } });
const env = { ...process.env, DATABASE_URL: target.href };
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assessment-release-test-'));
let created = false;
function run(script, args = [], status = 0) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  assert.equal(result.status, status, `Unexpected exit from ${path.basename(script)}: ${result.stderr}`);
  return result.stdout.trim().split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return line; } });
}
async function main() {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`); created = true;
  run(require.resolve('prisma/build/index.js'), ['db', 'push', '--skip-generate']);
  run(require.resolve('prisma/build/index.js'), ['db', 'execute', '--schema', 'prisma/schema.prisma', '--file', 'prisma/migrations/202610270003_assessment_bank_revisions/migration.sql']);
  const [security] = await db.$queryRawUnsafe("SELECT relrowsecurity, NOT EXISTS (SELECT FROM aclexplode(relacl) WHERE grantee=0) AS no_public_grants FROM pg_class WHERE oid='public.assessment_bank_revisions'::regclass");
  assert.equal(security.relrowsecurity, true); assert.equal(security.no_public_grants, true);
  const skill = await db.skill.create({ data: { name: 'JavaScript', slug: 'javascript', category: 'BACKEND' } });
  const exam = await db.assessment.create({ data: { title: 'Release test', slug: 'coding-algorithm-sandbox', type: 'PRACTICAL_CODING', skillId: skill.id,
    questions: { create: (single ? bank.questions.slice(0, 1) : bank.questions).map(q => ({ ...q, starterCode: '// legacy starter' })) } }, include: { questions: true } });
  const user = await db.user.create({ data: { email: 'release-test@example.invalid', candidateProfile: { create: { fullName: 'Release test' } } }, include: { candidateProfile: true } });
  const attempt = await db.assessmentAttempt.create({ data: { assessmentId: exam.id, candidateId: user.candidateProfile.id, status: 'COMPLETED', score: 25, maxScore: single ? 50 : 100, percentage: single ? 50 : 25, snapshot: { legacy: true },
    answers: { create: { questionId: exam.questions[0].id, submittedCode: '// historical answer', pointsEarned: 25 } } }, include: { answers: true } });
  const release = path.join(root, 'scripts/release-javascript-assessment.cjs');
  if (single) run(release, [], 1);
  const flags = single ? ['--expand-single-question'] : [];
  const plan = run(release, flags)[0]; assert.equal(plan.status, 'PLAN_ONLY');
  assert.equal((await db.assessment.findUniqueOrThrow({ where: { id: exam.id } })).version, 1);
  run(release, [...flags, '--apply', '--expected-hash', 'stale', '--backup-dir', backupDir], 1);
  assert.equal(fs.readdirSync(backupDir).length, 0);
  const active = await db.assessmentAttempt.create({ data: { assessmentId: exam.id, candidateId: user.candidateProfile.id } });
  run(release, [...flags, '--apply', '--expected-hash', plan.expectedHash, '--backup-dir', backupDir], 1);
  assert.equal(await db.assessmentBankRevision.count(), 0, 'Rejected release must roll back the archive');
  assert.equal((await db.assessment.findUniqueOrThrow({ where: { id: exam.id } })).version, 1);
  await db.assessmentAttempt.delete({ where: { id: active.id } });
  const applied = run(release, [...flags, '--apply', '--expected-hash', plan.expectedHash, '--backup-dir', backupDir]);
  assert.equal(applied.at(-1).status, 'APPLIED');
  const backup = JSON.parse(fs.readFileSync(applied.at(-1).backupFile)); assert.equal(backup.version, 1);
  assert.equal(run(release)[0].status, 'ALREADY_CURRENT');
  assert.deepEqual(await db.assessmentAttempt.findUniqueOrThrow({ where: { id: attempt.id }, include: { answers: true } }), attempt);
  const updated = await db.assessment.findUniqueOrThrow({ where: { id: exam.id }, include: { questions: true } });
  assert.equal(updated.questions.length, 2);
  assert(exam.questions.every(q => updated.questions.some(next => next.id === q.id)));
  const archived = await db.assessmentBankRevision.findUniqueOrThrow({ where: { assessmentId_version: { assessmentId: exam.id, version: 1 } } });
  assert.equal(archived.contentHash, plan.expectedHash);
  assert.equal(archived.snapshot.questions.length, single ? 1 : 2);
  assert.equal(archived.snapshot.questions[0].starterCode, '// legacy starter');
  assert.equal(await db.assessmentBankRevision.count(), 1);
  await db.assessment.update({ where: { id: exam.id }, data: { version: 3 } });
  run(release, [], 1);
  console.log(`PASS (${single ? 'one-to-two' : 'two-to-two'}): explicit scope, read-only plan, stale-hash and active-attempt rejection, atomic archive, backup, idempotency, preserved IDs/results/denominators/snapshots, newer-version rejection`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  await db.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.$disconnect();
});
