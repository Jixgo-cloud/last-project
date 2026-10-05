// Private application backup. Never print connection strings or pg_dump stderr.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
function option(name) { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; }
const project = option('--project-ref');
const output = option('--out');
assert(project && /^[a-z]{20}$/.test(project) && output && path.isAbsolute(output), 'Supply --project-ref and an absolute --out directory');
const destination = path.resolve(output);
const relative = path.relative(root, destination);
assert(relative.startsWith('..' + path.sep) || path.isAbsolute(relative), 'Backups must be outside the Git checkout');

let connection;
for (const file of ['apps/api.env', 'apps/api/.env', '.env']) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) continue;
  const values = dotenv.parse(fs.readFileSync(source));
  for (const name of ['DIRECT_URL', 'DATABASE_URL']) {
    if (!values[name]) continue;
    try {
      const candidate = new URL(values[name]);
      if (['postgres:', 'postgresql:'].includes(candidate.protocol) &&
          (candidate.hostname === `db.${project}.supabase.co` ||
           (candidate.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(candidate.username) === `postgres.${project}`))) {
        connection = candidate; break;
      }
    } catch {}
  }
  if (connection) break;
}
assert(connection, 'No existing credential matches the confirmed Supabase project; no backup or changes performed');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.join(destination, stamp);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
if (process.platform === 'win32') {
  const principal = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
  const acl = spawnSync('icacls', [dir, '/inheritance:r', '/grant:r', `${principal}:(OI)(CI)F`], { windowsHide: true, encoding: 'utf8' });
  assert.equal(acl.status, 0, 'Cannot restrict backup directory access; refusing to export');
}
const env = { ...process.env, PGHOST: connection.hostname, PGPORT: connection.port || '5432', PGUSER: decodeURIComponent(connection.username), PGPASSWORD: decodeURIComponent(connection.password), PGDATABASE: connection.pathname.slice(1), PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '15' };
const file = path.join(dir, 'smartcareer-public.dump');
const dump = spawnSync(process.env.PG_DUMP_BIN || 'pg_dump', ['--format=custom', '--schema=public', '--file', file], { env, windowsHide: true, encoding: 'utf8', timeout: 300000 });
assert.equal(dump.status, 0, 'Backup failed; credential-bearing stderr suppressed; incomplete archive must not be used');
fs.chmodSync(file, 0o600);
const listing = spawnSync(process.env.PG_RESTORE_BIN || 'pg_restore', ['--list', file], { windowsHide: true, encoding: 'utf8', timeout: 30000 });
assert.equal(listing.status, 0, 'Backup archive validation failed');
fs.writeFileSync(path.join(dir, 'archive-contents.txt'), listing.stdout, { mode: 0o600 });
const manifest = {
  project, createdAt: new Date().toISOString(), file,
  scope: 'Public application schema, data, owners, grants and policies. Supabase-managed schemas and Storage object files excluded.',
  bytes: fs.statSync(file).size,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  tableDataEntries: listing.stdout.split('\n').filter(line => line.includes(' TABLE DATA ')).length,
  archiveValidated: true, restoreTested: false,
};
assert(manifest.bytes > 0 && manifest.tableDataEntries > 0, 'Empty backup must not be reported as successful');
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
console.log(JSON.stringify(manifest));
