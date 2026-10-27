// Explicit local upgrade with a PostgreSQL custom-format backup and row fingerprints.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const root = path.resolve(__dirname, '..');
const env = { ...require('dotenv').parse(fs.readFileSync(path.join(root, '.env'))),
  ...require('dotenv').parse(fs.readFileSync(path.join(root, 'apps/api/.env'))), ...process.env };
const source = new URL(env.DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname), 'This upgrade script is restricted to local PostgreSQL.');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.join(os.homedir(), '.codex', 'backups', 'smartcareer', stamp);
fs.mkdirSync(dir, { recursive: true });
const bin = process.env.PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const pgEnv = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
const connection = ['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username)];
const backup = path.join(dir, 'before-upgrade.dump');
function pg(exe, args) {
  const result = spawnSync(path.join(bin, exe + '.exe'), args, { env: pgEnv, windowsHide: true, timeout: 120000, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${exe} failed: ${(result.stderr || '').slice(0, 1000)}`);
  return result.stdout;
}
const db = new PrismaClient({ datasources: { db: { url: source.href } } });
const migrations = ['scripts/sql/assessment-framework.sql', 'prisma/migrations/202610270001_assessment_matching/migration.sql',
  'prisma/migrations/202610270002_skill_categories/migration.sql'];
const newColumns = ['frameworkCode', 'frameworkVersion', 'frameworkScope', 'frameworkTopicId', 'frameworkMappingNote', 'matchAssessmentSnapshot'];
const quote = value => '"' + value.replaceAll('"', '""') + '"';
async function fingerprints(client) {
  const tables = await client.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const result = {};
  for (const { tablename } of tables) {
    const rows = await client.$queryRawUnsafe(`SELECT to_jsonb(t) - ARRAY[${newColumns.map(c => "'"+c+"'").join(',')}] AS data FROM public.${quote(tablename)} t`);
    const normalized = rows.map(row => JSON.stringify(row.data)).sort();
    result[tablename] = { rows: rows.length, sha256: crypto.createHash('sha256').update(normalized.join('\n')).digest('hex') };
  }
  return result;
}
async function migrate(client) {
  await client.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout='10s'");
    for (const file of migrations) {
      const statements = fs.readFileSync(path.join(root, file), 'utf8').replace(/--[^\r\n]*/g, '').split(';')
        .map(s => s.trim()).filter(s => s && !/^(BEGIN|COMMIT)$/i.test(s));
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
    }
  }, { timeout: 60000 });
}
(async () => {
  const before = await fingerprints(db);
  pg('pg_dump', [...connection, '-d', source.pathname.slice(1), '-Fc', '-f', backup]);
  const entries = pg('pg_restore', ['--list', backup]).split('\n').filter(l => l && !l.startsWith(';')).length;
  assert(entries > 0, 'Empty backup');
  await migrate(db);
  assert.deepEqual(await fingerprints(db), before, 'Existing data changed during upgrade');
  await db.assessment.findMany({ take: 1, include: { questions: true } });
  await db.jobApplication.findMany({ take: 1 });
  const qaName = 'smartcareer_live_judge_' + Date.now();
  await db.$executeRawUnsafe(`CREATE DATABASE ${quote(qaName)}`);
  pg('pg_restore', [...connection, '-d', qaName, '--no-owner', '--exit-on-error', backup]);
  const qaUrl = new URL(source); qaUrl.pathname = '/' + qaName;
  const qa = new PrismaClient({ datasources: { db: { url: qaUrl.href } } });
  try { await migrate(qa); assert.deepEqual(await fingerprints(qa), before, 'Restore verification failed'); }
  finally { await qa.$disconnect(); }
  const report = { upgradedAt: new Date().toISOString(), database: source.pathname.slice(1), backup,
    backupEntries: entries, tables: Object.keys(before).length, preservedRows: Object.values(before).reduce((s, t) => s+t.rows, 0),
    preservedFingerprints: before, migrations, restoreVerified: true, qaDatabase: qaName };
  fs.writeFileSync(path.join(dir, 'upgrade-report.json'), JSON.stringify(report, null, 2));
  const privateRun = path.join(os.homedir(), '.codex', 'smartcareer-live-qa.json');
  fs.writeFileSync(privateRun, JSON.stringify({ databaseUrl: qaUrl.href, reportPath: path.join(dir, 'upgrade-report.json'), backup, qaName }));
  console.log(JSON.stringify({ database: report.database, tables: report.tables, preservedRows: report.preservedRows,
    backup, restoreVerified: true, qaDatabase: qaName, privateRun }));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
