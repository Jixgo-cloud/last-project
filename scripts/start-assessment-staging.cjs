// Deliberately isolated local staging. Does not inherit production integration secrets.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const file = path.join(os.homedir(), '.codex/smartcareer-assessment-staging.json');
const cfg = JSON.parse(fs.readFileSync(file));
const url = new URL(cfg.databaseUrl);
assert(['localhost','127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/smartcareer_assessment_staging_'));
assert.equal(cfg.apiUrl, 'http://127.0.0.1:4100/api'); assert.equal(cfg.webUrl, 'http://localhost:3100');
cfg.jwtSecret ||= crypto.randomBytes(48).toString('hex');
const provider = process.env.STAGING_JUDGE0_URL || 'https://ce.judge0.com';
assert(['https://ce.judge0.com', 'https://judge0-ce.p.rapidapi.com'].includes(provider));
const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP,
  HOME: os.homedir(), USERPROFILE: os.homedir(), DATABASE_URL: cfg.databaseUrl, NODE_ENV: 'development',
  HOST: '127.0.0.1', PORT: '4100', FRONTEND_URL: cfg.webUrl, ALLOWED_ORIGINS: cfg.webUrl,
  API_URL: cfg.apiUrl, NEXT_PUBLIC_API_URL: cfg.apiUrl, ENABLE_SCHEDULED_JOBS: 'false',
  JWT_SECRET: cfg.jwtSecret, JWT_EXPIRES_IN: '4h', ENABLE_DEV_MOCK_AUTH: 'true', NEXT_PUBLIC_SHOW_DEMO_LOGIN: 'true', NEXT_TELEMETRY_DISABLED: '1',
  JUDGE0_BASE_URL: provider, JUDGE0_API_URL: '', JUDGE0_API_KEY: process.env.STAGING_JUDGE0_KEY || '', RAPIDAPI_KEY: '',
  GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GITHUB_CLIENT_ID: '', GITHUB_CLIENT_SECRET: '',
  GEMINI_API_KEY: '', JSEARCH_API_KEY: '', YOUTUBE_API_KEY: '' };
async function portFree(port) {
  await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(resolve));});
}
function start(name, entry, args, cwd) {
  const log = path.join(cfg.dir, name + '.log'); const fd=fs.openSync(log,'a');
  const child=spawn(process.execPath,[entry,...args],{cwd,env,windowsHide:true,detached:true,stdio:['ignore',fd,fd]});
  child.unref(); fs.closeSync(fd); return { pid:child.pid,log };
}
async function ready(url) {
  const deadline = Date.now()+90000;
  while(Date.now()<deadline) {
    try { if((await fetch(url,{signal:AbortSignal.timeout(3000)})).ok) return; } catch {}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error('Staging did not become ready: '+url);
}
(async()=>{
  if(!process.argv.includes('--web-only')) await portFree(4100);
  if(!process.argv.includes('--api-only')) await portFree(3100);
  cfg.provider=provider; cfg.servers ||= {};
  if(!process.argv.includes('--web-only')) cfg.servers.api=start('api',path.join(root,'apps/api/dist/main.js'),[],path.join(root,'apps/api'));
  if(!process.argv.includes('--api-only')) cfg.servers.web=start('web',path.join(root,'node_modules/next/dist/bin/next'),['dev','-p','3100','-H','127.0.0.1'],path.join(root,'apps/web'));
  fs.writeFileSync(file,JSON.stringify(cfg,null,2),{mode:0o600});
  await ready(cfg.apiUrl+'/health/ready');
  if(!process.argv.includes('--api-only')) await ready(cfg.webUrl+'/login');
  console.log(JSON.stringify({api:cfg.apiUrl,web:cfg.webUrl,provider,scheduledJobs:false,servers:cfg.servers}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
