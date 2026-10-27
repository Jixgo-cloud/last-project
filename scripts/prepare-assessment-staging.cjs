// Local-only rehearsal from an existing production archive. Never connects to production.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const root = path.resolve(__dirname, '..');
const source = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname), 'Local PostgreSQL required');
const backup = path.resolve(process.env.STAGING_BACKUP_FILE);
assert(fs.statSync(backup).isFile());
const stamp = Date.now();
const name = `smartcareer_assessment_staging_${stamp}`;
const target = new URL(source); target.pathname = '/' + name;
const dir = path.join(os.homedir(), '.codex/backups/smartcareer', name);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const configFile = path.join(os.homedir(), '.codex/smartcareer-assessment-staging.json');
const bin = process.env.PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const pgEnv = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
const env = { ...process.env, DATABASE_URL: target.href };
const admin = new PrismaClient({ datasources: { db: { url: source.href } } });
const db = new PrismaClient({ datasources: { db: { url: target.href } } });
function execute(exe, args, commandEnv = env) {
  const r = spawnSync(exe, args, { cwd: root, env: commandEnv, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  if (r.status !== 0) throw new Error(`${path.basename(exe)} failed: ${r.stderr}`);
  return r.stdout;
}
const pg = (name, args) => execute(path.join(bin, name + (process.platform === 'win32' ? '.exe' : '')), args, pgEnv);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const quoted = name => '"' + name.replaceAll('"', '""') + '"';
async function fingerprints() {
  const tables = await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const result = {};
  for (const { tablename } of tables) {
    if (tablename === 'assessment_bank_revisions') continue;
    const rows = await db.$queryRawUnsafe(`SELECT to_jsonb(t) - ARRAY['frameworkCode','frameworkVersion','frameworkScope','frameworkTopicId','frameworkMappingNote','matchAssessmentSnapshot'] AS data FROM public.${quoted(tablename)} t`);
    result[tablename] = { rows: rows.length, hash: hash(rows.map(r => JSON.stringify(r.data)).sort().join('\n')) };
  }
  return result;
}
(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE ${quoted(name)}`);
  const list = pg('pg_restore', ['--list', backup]).split('\n').filter(l => !/ SCHEMA - public /.test(l)).join('\n');
  const listFile = path.join(dir, 'restore-list.txt'); fs.writeFileSync(listFile, list);
  pg('pg_restore', ['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username),
    '-d', name, '--no-owner', '--no-acl', '--exit-on-error', '--use-list', listFile, backup]);
  const before = await fingerprints();
  const migrations = ['scripts/sql/assessment-framework.sql', 'prisma/migrations/202610270001_assessment_matching/migration.sql',
    'prisma/migrations/202610270002_skill_categories/migration.sql', 'prisma/migrations/202610270003_assessment_bank_revisions/migration.sql'];
  for (const file of migrations) execute(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'execute', '--schema', 'prisma/schema.prisma', '--file', file]);
  assert.deepEqual(await fingerprints(), before, 'Schema migration changed original data');
  // Repeat the additive SQL to verify safe reruns.
  for (const file of migrations) execute(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'execute', '--schema', 'prisma/schema.prisma', '--file', file]);
  const diff = execute(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code']);
  const original = await db.assessment.findUniqueOrThrow({ where: { slug: 'coding-algorithm-sandbox' }, include: { questions: true } });
  assert.equal(original.questions.length, 1, 'This rehearsal must exercise the production one-question path');
  const history = await db.assessmentAttempt.findMany({ where: { assessmentId: original.id }, include: { answers: true }, orderBy: { id: 'asc' } });
  const release = path.join(root, 'scripts/release-javascript-assessment.cjs');
  const plan = JSON.parse(execute(process.execPath, [release, '--expand-single-question']).trim());
  const applied = execute(process.execPath, [release, '--expand-single-question', '--apply', '--expected-hash', plan.expectedHash, '--backup-dir', dir]);
  const again = JSON.parse(execute(process.execPath, [release, '--expand-single-question']).trim());
  assert.equal(again.status, 'ALREADY_CURRENT');
  assert.deepEqual(await db.assessmentAttempt.findMany({ where: { assessmentId: original.id }, include: { answers: true }, orderBy: { id: 'asc' } }), history);
  const after = await fingerprints();
  for (const table of Object.keys(before).filter(t => !['assessments', 'questions'].includes(t))) assert.deepEqual(after[table], before[table], table);
  assert.equal(after.assessments.rows, before.assessments.rows);
  assert.equal(after.questions.rows, before.questions.rows + 1);
  const archive = await db.assessmentBankRevision.findUniqueOrThrow({ where: { assessmentId_version: { assessmentId: original.id, version: 1 } } });
  assert.equal(archive.snapshot.questions.length, 1);
  assert.equal(archive.contentHash, plan.expectedHash);
  const q = await db.question.findUniqueOrThrow({ where: { id: original.questions[0].id } }); assert.equal(q.version, require('../prisma/assessment-bank/javascript-sandbox.json').version);
  const report = { checkedAt: new Date().toISOString(), database: name, sourceBackup: path.basename(backup), sourceBackupHash: hash(fs.readFileSync(backup)),
    backupScope: 'public schema only; owner/ACL restoration excluded', productionWrites: false,
    before, after, migrations, diff: diff.trim(), plan, applied: applied.trim(), idempotent: true,
    preservedAttempts: history.length, preservedAnswers: history.reduce((n,a) => n+a.answers.length,0),
    preservedCompletedResults: history.filter(a=>a.status==='COMPLETED').map(a=>({id:a.id,score:a.score,maxScore:a.maxScore,percentage:a.percentage,version:a.assessmentVersion})),
    archiveRows: await db.assessmentBankRevision.count() };
  fs.writeFileSync(path.join(dir, 'migration-evidence.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  fs.writeFileSync(configFile, JSON.stringify({ databaseUrl: target.href, dir, assessmentId: original.id,
    apiUrl: 'http://127.0.0.1:4100/api', webUrl: 'http://localhost:3100', historicalAttemptId: history.find(a=>a.status==='COMPLETED')?.id }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ database: name, dir, schemaDiff: report.diff, originalTables: Object.keys(before).length,
    preservedAttempts: report.preservedAttempts, preservedAnswers: report.preservedAnswers, expandedQuestions: '1 -> 2', configFile }));
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(async()=>{await db.$disconnect();await admin.$disconnect();});
