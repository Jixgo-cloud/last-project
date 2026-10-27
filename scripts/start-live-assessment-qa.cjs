// Run against the verified local backup clone; credentials stay outside the repository.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const privateFile = path.join(os.homedir(), '.codex', 'smartcareer-live-qa.json');
const cfg = JSON.parse(fs.readFileSync(privateFile, 'utf8'));
const url = new URL(cfg.databaseUrl);
assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/smartcareer_live_judge_'));
const env = { ...require('dotenv').parse(fs.readFileSync(path.join(root, '.env'))),
  ...require('dotenv').parse(fs.readFileSync(path.join(root, 'apps/api/.env'))), ...process.env,
  DATABASE_URL: cfg.databaseUrl, NODE_ENV: 'development', PORT: '4000',
  FRONTEND_URL: 'http://localhost:3000', ALLOWED_ORIGINS: 'http://localhost:3000',
  API_URL: 'http://localhost:4000/api', NEXT_PUBLIC_API_URL: 'http://localhost:4000/api',
  ENABLE_DEV_MOCK_AUTH: 'true', NEXT_PUBLIC_SHOW_DEMO_LOGIN: 'true', NEXT_TELEMETRY_DISABLED: '1' };
const logDir = path.dirname(cfg.reportPath);
function start(name, entry, args, cwd) {
  const log = path.join(logDir, name + '.log');
  const fd = fs.openSync(log, 'a');
  const child = spawn(process.execPath, [entry, ...args], { cwd, env, windowsHide: true, detached: true, stdio: ['ignore', fd, fd] });
  child.unref(); fs.closeSync(fd);
  return { pid: child.pid, log };
}
cfg.servers = { ...cfg.servers, api: start('api', path.join(root, 'apps/api/dist/main.js'), [], path.join(root, 'apps/api')) };
if (!process.argv.includes('--api-only')) {
  cfg.servers.web = start('web', path.join(root, 'node_modules/next/dist/bin/next'), ['dev', '-p', '3000', '-H', '127.0.0.1'], path.join(root, 'apps/web'));
}
fs.writeFileSync(privateFile, JSON.stringify(cfg, null, 2));
console.log(JSON.stringify(cfg.servers, null, 2));
