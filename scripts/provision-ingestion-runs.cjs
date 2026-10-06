// Provision only the additive ingestion_runs table. Never print credentials or psql stderr.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const project = option('--project-ref');
const manifestPath = option('--backup-manifest');
assert(project && /^[a-z]{20}$/.test(project) && manifestPath && path.isAbsolute(manifestPath), 'Supply project reference and absolute backup manifest');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifest.project === project && manifest.archiveValidated && manifest.bytes > 0 && manifest.tableDataEntries >= 28, 'Validated application backup required');
assert(Date.now() - Date.parse(manifest.createdAt) < 3600000, 'Backup must be less than one hour old');
assert(crypto.createHash('sha256').update(fs.readFileSync(manifest.file)).digest('hex') === manifest.sha256, 'Backup checksum mismatch');
let connection;
for (const file of ['apps/api.env', 'apps/api/.env', '.env']) {
  const name = path.join(root, file);
  if (!fs.existsSync(name)) continue;
  const values = dotenv.parse(fs.readFileSync(name));
  for (const key of ['DIRECT_URL', 'DATABASE_URL']) {
    if (!values[key]) continue;
    try {
      const candidate = new URL(values[key]);
      if (['postgres:', 'postgresql:'].includes(candidate.protocol) &&
        (candidate.hostname === `db.${project}.supabase.co` ||
          (candidate.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(candidate.username) === `postgres.${project}`))) {
        connection = candidate; break;
      }
    } catch { /* no credential output */ }
  }
  if (connection) break;
}
assert(connection, 'No configured connection matches confirmed project');
const env = {...process.env, PGHOST:connection.hostname, PGPORT:connection.port || '5432', PGUSER:decodeURIComponent(connection.username),
  PGPASSWORD:decodeURIComponent(connection.password), PGDATABASE:connection.pathname.slice(1), PGSSLMODE:'require', PGCONNECT_TIMEOUT:'15'};
const run = spawnSync('psql', ['-X', '--set=ON_ERROR_STOP=1', '--file', path.join(__dirname,'sql/ingestion-runs.sql')], {env,windowsHide:true,encoding:'utf8',timeout:60000});
assert.equal(run.status,0,'Ingestion table provisioning failed; private database output suppressed');
const check = spawnSync('psql', ['-X','-At','--set=ON_ERROR_STOP=1','--command',
  `SELECT json_build_object('rls',relrowsecurity,'publicGrants',(SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='ingestion_runs' AND grantee IN ('anon','authenticated','PUBLIC')),'tableCount',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')) FROM pg_class WHERE oid='public.ingestion_runs'::regclass`],
  {env,windowsHide:true,encoding:'utf8',timeout:30000});
assert.equal(check.status,0,'Cannot verify ingestion table access');
const verified = JSON.parse(check.stdout.trim());
assert(verified.rls && verified.publicGrants === 0,'Ingestion tracking must not be exposed to client roles');
console.log(JSON.stringify({project,provisioned:true,...verified}));
