// Regression against an isolated local database; never seed or edit the configured database.
const fs = require('fs');
const path = require('path');
const net = require('net');
const assert = require('assert/strict');
const { spawn, spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const puppeteer = require('puppeteer-core');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '..');
const keepManualUi = process.argv.includes('--manual-ui');
const configured = { ...(fs.existsSync(path.join(root, '.env')) ? dotenv.parse(fs.readFileSync(path.join(root, '.env'))) : {}), ...process.env };
const sourceUrl = new URL(configured.DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(sourceUrl.hostname), 'Regression requires a local PostgreSQL server');
const databaseName = `smartcareer_regression_${Date.now()}`;
const testUrl = new URL(sourceUrl);
testUrl.pathname = '/' + databaseName;
const evidenceDir = path.join(root, 'output', 'core-regression', databaseName);
fs.mkdirSync(evidenceDir, { recursive: true });
const env = { ...process.env, ...configured, DATABASE_URL: testUrl.href, NODE_ENV: 'development', PORT: '4000', FRONTEND_URL: 'http://localhost:3000', NEXT_PUBLIC_API_URL: 'http://localhost:4000/api', NEXT_TELEMETRY_DISABLED: '1', JWT_EXPIRES_IN: '5m', INGESTION_CONFIG_DIR: path.join(evidenceDir, 'ingestion-config'), API_URL: 'http://localhost:4000/api', JUDGE0_BASE_URL: 'http://127.0.0.1:2359', JUDGE0_API_KEY: '', RAPIDAPI_KEY: '' };
const admin = new PrismaClient({ datasources: { db: { url: sourceUrl.href } } });
const db = new PrismaClient({ datasources: { db: { url: testUrl.href } } });
const results = [];
const children = [];
const logs = [];
const apiFailures = [];
const expectedApiResponses = new Map();
let judgeFixture;
let browser;
let page;
let created = false;
const report = { startedAt: new Date().toISOString(), database: databaseName, isolated: true, results, apiFailures, cleanedUp: false };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check(name, fn) {
  await fn();
  results.push({ name, verdict: 'PASS' });
  console.log('PASS: ' + name);
}
async function freePort(port) {
  await new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', () => reject(new Error(`Port ${port} is in use; refusing to replace an existing server`))); server.listen(port, '127.0.0.1', () => server.close(resolve)); });
}
function launch(name, args, cwd, overrides = {}) {
  const fd = fs.openSync(path.join(evidenceDir, name + '.log'), 'w');
  logs.push(fd);
  const child = spawn(process.execPath, args, { cwd, env: { ...env, ...overrides }, windowsHide: true, stdio: ['ignore', fd, fd] });
  children.push(child);
  return child;
}
async function waitReady(url, child) {
  const end = Date.now() + 45000;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error('Server exited; inspect local evidence log');
    try { const res = await fetch(url, { signal: AbortSignal.timeout(1500) }); if (res.ok) return; } catch {}
    await pause(500);
  }
  throw new Error('Server did not become ready: ' + url);
}
async function request(endpoint, method = 'GET', body, token) {
  const res = await fetch('http://localhost:4000/api' + endpoint, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(90000) });
  const data = await res.json();
  assert(res.ok, `${method} ${endpoint} returned ${res.status}: ${typeof data.message === 'string' ? data.message : 'request failed'}`);
  return data;
}
async function requestResult(endpoint, method = 'GET', body, token) {
  const res = await fetch('http://localhost:4000/api' + endpoint, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(90000) });
  return { status: res.status, data: await res.json() };
}
async function clickText(text) {
  await page.waitForFunction(text => Array.from(document.querySelectorAll('button')).some(b => !b.disabled && b.innerText.includes(text)), { timeout: 15000 }, text);
  for (const handle of await page.$$('button')) {
    if (await handle.evaluate((el, text) => !el.disabled && el.innerText.includes(text), text)) { await handle.evaluate(el => el.click()); return; }
  }
  throw new Error('Button missing: ' + text);
}
async function goto(route) { await page.goto('http://localhost:3000' + route, { waitUntil: 'networkidle2', timeout: 30000 }); assert((await page.$eval('body', e => e.innerText)).length > 50, 'Page was blank: ' + route); }
async function activate(selector) {
  const handle = await page.waitForSelector(selector, { visible: true });
  assert(!(await handle.evaluate(el => el.disabled)), 'Cannot activate a disabled button');
  await handle.evaluate(el => el.click());
}
async function fill(selector, value) {
  await page.bringToFront();
  await page.focus(selector);
  await page.waitForFunction(sel => document.activeElement === document.querySelector(sel), { timeout: 5000 }, selector);
  await page.$eval(selector, el => el.select());
  await page.keyboard.sendCharacter(value);
  const actual = await page.$eval(selector, el => el.value);
  if (actual !== value) {
    report.inputFailure = await page.$eval(selector, el => ({ type: el.type, focused: document.activeElement === el, pageFocused: document.hasFocus(), activeTag: document.activeElement?.tagName, inputCount: document.querySelectorAll('input').length, actualLength: el.value.length, disabled: el.disabled, readOnly: el.readOnly }));
    report.browserVersion = await browser.version();
  }
  assert.equal(actual, value, 'The browser did not fill the requested field: ' + selector);
}
async function login(email, password, landing) {
  await goto('/login');
  await page.evaluate(() => localStorage.removeItem('smartcareer_token'));
  await goto('/login');
  await fill('input[type="email"]', email);
  await fill('input[type="password"]', password);
  await Promise.all([page.waitForFunction(route => location.pathname === route, { timeout: 20000 }, landing), activate('button[type="submit"]')]);
  assert.equal(await page.evaluate(() => localStorage.getItem('smartcareer_token')), null, 'Bearer token must not be stored in localStorage');
  const cookie = (await browser.cookies()).find(c => c.name === 'smartcareer_session');
  assert(cookie && cookie.httpOnly, 'UI login must persist an HttpOnly session');
  assert(!(await page.evaluate(() => document.cookie)).includes('smartcareer_session'), 'JavaScript must not read the session');
  const token = (await request('/auth/login', 'POST', { email, password })).token;
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.equal(claims.exp - claims.iat, 300, 'JWT_EXPIRES_IN did not control the session lifetime');
  return token;
}
async function screenshot(name) { await page.screenshot({ path: path.join(evidenceDir, name + '.png'), fullPage: false }); }

async function run() {
  await freePort(3000); await freePort(4000); await freePort(2359);
  judgeFixture = require('./fixtures/judge0.cjs').createJudgeFixture();
  await new Promise(resolve => judgeFixture.listen(2359, '127.0.0.1', resolve));
  report.interactionMode = 'Browser text input and DOM button activation; manual pointer checks are separate';
  report.judgeProvider = 'Deterministic fixture; no applicant code is executed locally';
  const sourceCounts = { users: await admin.user.count(), jobs: await admin.job.count(), attempts: await admin.assessmentAttempt.count() };
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`); created = true;
  const schema = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'db', 'push', '--schema', path.join(root, 'prisma/schema.prisma'), '--skip-generate'], { cwd: root, env, windowsHide: true, encoding: 'utf8' });
  fs.writeFileSync(path.join(evidenceDir, 'schema.log'), schema.stdout + schema.stderr);
  assert.equal(schema.status, 0, 'Could not initialize isolated database');
  const hash = await bcrypt.hash('password123', 10);
  const candidate = await db.user.create({ data: { email: 'candidate@smartcareer.dev', passwordHash: hash, role: 'CANDIDATE', candidateProfile: { create: { fullName: 'Regression Candidate', targetCareer: 'Backend Developer' } } }, include: { candidateProfile: true } });
  const employer = await db.user.create({ data: { email: 'hr@techcorp.co.th', passwordHash: hash, role: 'COMPANY' } });
  await db.user.create({ data: { email: 'admin@smartcareer.dev', passwordHash: await bcrypt.hash('admin123', 10), role: 'ADMIN' } });
  const company = await db.company.create({ data: { name: 'Regression Test Company', slug: databaseName, members: { create: { userId: employer.id, role: 'OWNER' } } } });
  const skill = await db.skill.create({ data: { name: 'JavaScript', slug: 'javascript', category: 'BACKEND' } });
  await db.candidateSkill.create({ data: { candidateId: candidate.candidateProfile.id, skillId: skill.id, practicalScore: 80 } });
  const theory = await db.assessment.create({ data: { title: 'Regression Theory', slug: 'regression-theory', type: 'THEORY', skillId: skill.id, questions: { create: { title: 'Regression choice', prompt: 'Choose the correct regression answer.', points: 10, choices: { create: [{ text: 'Correct regression answer', isCorrect: true, order: 0 }, { text: 'Incorrect regression answer', isCorrect: false, order: 1 }] } } } }, include: { questions: { include: { choices: true } } } });
  const coding = await db.assessment.create({ data: { title: 'Regression Coding', slug: 'regression-coding', type: 'PRACTICAL_CODING', skillId: skill.id, questions: { create: { title: 'Add two numbers', prompt: 'Implement function solution(a, b) returning their sum.', points: 100, starterCode: 'function solution(a, b) { return a + b; }', testCases: [{ input: '[2,3]', expectedOutput: '5', isHidden: false }, { input: '[10,20]', expectedOutput: '30', isHidden: true }] } } }, include: { questions: true } });
  const apiChild = launch('api', [path.join(root, 'apps/api/dist/main.js')], root);
  await waitReady('http://localhost:4000/api/health', apiChild);
  const webChild = launch('web', [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', '3000'], path.join(root, 'apps/web'), { NODE_ENV: 'production' });
  await waitReady('http://localhost:3000/login', webChild);
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : '/usr/bin/google-chrome');
  browser = await puppeteer.launch({ executablePath, headless: process.env.PUPPETEER_HEADLESS !== 'false', args: process.env.CI ? ['--no-sandbox'] : [], defaultViewport: { width: 1366, height: 900 } });
  page = await browser.newPage();
  const pageErrors = []; report.browserErrors = pageErrors;
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => {
    if (!/^http:\/\/localhost:(3000|4000)\/api/.test(response.url()) || response.status() < 400) return;
    const requestPath = new URL(response.url()).pathname;
    if (requestPath === '/api/auth/me' && response.status() === 401) return;
    if (expectedApiResponses.get(requestPath) === response.status()) return;
    apiFailures.push({ path: requestPath, status: response.status() });
  });
  page.on('dialog', dialog => {
    void dialog.accept().catch(error => {
      // Chrome can close the dialog before a duplicate event is handled.
      // The deletion check still verifies the resulting database change.
      if (!error.message.includes('No dialog is showing')) pageErrors.push(error.message);
    });
  });
  await check('Home and login pages render', async () => { await goto('/'); await screenshot('home'); await goto('/login'); assert(await page.$('input[type="email"]')); });
  await check('Guest job favorites explain sign-in without blocking browser dialogs or saving data', async () => {
    const fixture = await db.job.create({data:{companyId:company.id,companyName:company.name,title:'Guest favorite fixture',slug:'guest-favorite-fixture',description:'Isolated regression only'}});
    let dialogs = 0;
    const countDialog = () => { dialogs++; };
    page.on('dialog', countDialog);
    try {
      for (const [route,selector] of [[`/jobs/${fixture.id}`,'#btn-favorite-job-detail'],['/jobs',`#btn-favorite-${fixture.id}`]]) {
        await goto(route);
        await page.waitForSelector(selector);
        await activate(selector);
        await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('กรุณาเข้าสู่ระบบเพื่อบันทึกงาน'));
        assert.equal(dialogs,0,'Guest favorites must not block the browser with alert()');
        assert.equal(await db.jobFavorite.count({where:{jobId:fixture.id}}),0);
        assert.equal(await page.$eval(selector, el => el.title),'บันทึกงานที่สนใจ');
      }
      await screenshot('guest-favorite-sign-in');
    } finally {
      page.off('dialog',countDialog);
      await db.job.delete({where:{id:fixture.id}});
    }
  });
  await check('Public GitHub lookup errors never fabricate a live profile', async () => {
    const endpoint = '/api/github/public/regression-missing-user';
    let failureStatus = 404;
    const intercept = request => {
      if (new URL(request.url()).pathname === endpoint) {
        void request.respond({ status: failureStatus, contentType:'application/json', body:JSON.stringify({message:'GitHub lookup unavailable'}) });
      } else { void request.continue(); }
    };
    await page.setRequestInterception(true);
    page.on('request', intercept);
    try {
      await goto('/');
      for (const status of [404, 503]) {
        failureStatus = status;
        expectedApiResponses.set(endpoint, status);
        await fill('input[aria-label="ชื่อผู้ใช้ GitHub"]', 'regression-missing-user');
        await clickText('วิเคราะห์');
        await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('ไม่สามารถวิเคราะห์ GitHub'));
        assert.equal(await page.$('[aria-label="ผลการวิเคราะห์ GitHub Profile"]'), null);
        assert(!(await page.$eval('body', el => el.innerText)).includes('Live API'));
      }
      await screenshot('github-lookup-error');
    } finally {
      page.off('request', intercept);
      await page.setRequestInterception(false);
      expectedApiResponses.delete(endpoint);
    }
  });
  let companyToken;
  let invalidLegacyAssessment;
  await check('Company login through UI', async () => { companyToken = await login('hr@techcorp.co.th', 'password123', '/company/dashboard'); await screenshot('company-login'); assert.equal((await request('/auth/me', 'GET', undefined, companyToken)).role, 'COMPANY'); });
  await check('Company without a request is not awaiting review', async () => {
    await goto('/company/dashboard');
    await page.waitForFunction(() => document.body.innerText.includes('ยังไม่ส่งเอกสาร'));
    assert(!(await page.$eval('body', el => el.innerText)).includes('กำลังรอผู้ดูแลระบบตรวจสอบเอกสาร'));
    assert.equal(await db.companyVerification.count(), 0);
    await goto('/company/profile');
    await page.waitForFunction(() => document.body.innerText.includes('ยังไม่ส่งเอกสาร'));
    await screenshot('company-not-submitted');
  });
  const submitCompanyDocuments = async () => {
    await fill('input[maxlength="13"]', '1234567890123');
    // A screenshot of this disposable test site is a non-identity upload fixture.
    await (await page.$('input[type="file"][multiple]')).uploadFile(path.join(evidenceDir, 'home.png'));
    await page.waitForFunction(() => document.body.innerText.includes('home.png'));
    await page.evaluate(() => document.querySelector('#verification button[type="submit"]').click());
    await page.waitForFunction(() => document.body.innerText.includes('ส่งคำขอแล้ว รอผู้ดูแลตรวจสอบ'));
    assert(await page.$$eval('button', buttons => buttons.some(b => b.disabled && b.innerText.includes('ส่งคำขอแล้ว รอผู้ดูแลตรวจสอบ'))));
  };
  await check('Verification form blocks incomplete ID and missing documents without saving', async () => {
    await fill('input[maxlength="13"]', '123');
    assert.equal(await page.$eval('input[maxlength="13"]', input => input.checkValidity()), false);
    await fill('input[maxlength="13"]', '1234567890123');
    await clickText('ยื่นตรวจสอบสิทธิ์พร้อมเอกสาร');
    await page.waitForFunction(() => document.body.innerText.includes('กรุณาแนบเอกสารอย่างน้อย 1 ไฟล์'));
    assert.equal(await db.companyVerification.count(), 0);
    await screenshot('verification-required-documents');
  });
  await check('Verification API rejects invalid ID and incomplete file content', async () => {
    const file = { name: 'test.pdf', type: 'application/pdf', size: 9, dataUrl: 'data:application/pdf;base64,' + Buffer.from('not a PDF').toString('base64') };
    for (const body of [
      { businessRegNo: '123', documents: { files: [file] } },
      { businessRegNo: '1234567890123' },
      { businessRegNo: '1234567890123', documents: { files: [] } },
      { businessRegNo: '1234567890123', documents: { files: [file] } },
    ]) assert.equal((await requestResult('/company/verify', 'POST', body, companyToken)).status, 400);
    assert.equal(await db.companyVerification.count(), 0);
  });
  await check('Concurrent company submissions and reviews cannot duplicate or overwrite outcomes', async () => {
    const owner = await db.user.create({ data: { email: 'parallel@smartcareer.dev', passwordHash: hash, role: 'COMPANY' } });
    const parallelCompany = await db.company.create({ data: { name: 'Parallel Test Company', slug: databaseName + '-parallel', members: { create: { userId: owner.id, role: 'OWNER' } } } });
    const colleague = await db.user.create({ data: { email: 'parallel-colleague@smartcareer.dev', passwordHash: hash, role: 'COMPANY' } });
    const inactive = await db.user.create({ data: { email: 'parallel-inactive@smartcareer.dev', passwordHash: hash, role: 'COMPANY', isActive: false } });
    await db.companyMember.createMany({ data: [colleague, inactive].map(user => ({ companyId: parallelCompany.id, userId: user.id })) });
    const token = (await request('/auth/login', 'POST', { email: owner.email, password: 'password123' })).token;
    const content = Buffer.from('%PDF-1.7\nTest-only concurrency fixture');
    const body = { businessRegNo: '1234567890123', documents: { files: [{ name: 'fixture.pdf', type: 'application/pdf', size: content.length, dataUrl: 'data:application/pdf;base64,' + content.toString('base64') }] } };
    const submitted = await Promise.all(Array.from({ length: 4 }, () => requestResult('/company/verify', 'POST', body, token)));
    assert.deepEqual(submitted.map(result => result.status).sort(), [201, 409, 409, 409]);
    assert.equal(await db.companyVerification.count({ where: { companyId: parallelCompany.id } }), 1);
    assert.equal((await db.company.findUnique({ where: { id: parallelCompany.id } })).verificationStatus, 'PENDING');
    const pending = submitted.find(result => result.status === 201).data;
    const adminToken = (await request('/auth/login', 'POST', { email: 'admin@smartcareer.dev', password: 'admin123' })).token;
    for (const reason of [undefined, '', '   ', 'สั้น', 42, 'x'.repeat(2001)]) {
      assert.equal((await requestResult('/admin/verifications/' + pending.id + '/review', 'PUT', { action: 'REJECT', reason }, adminToken)).status, 400);
    }
    assert.equal(await db.notification.count({ where: { userId: owner.id } }), 0);
    assert.equal((await db.companyVerification.findUnique({ where: { id: pending.id } })).status, 'PENDING');
    const reviews = await Promise.all(Array.from({ length: 2 }, () => requestResult('/admin/verifications/' + pending.id + '/review', 'PUT', { action: 'REJECT', reason: '  กรุณาแนบเอกสารที่อ่านเลขทะเบียนได้ชัดเจน  ' }, adminToken)));
    assert.deepEqual(reviews.map(result => result.status).sort(), [200, 409]);
    assert.equal(reviews.find(result => result.status === 200).data.documents, undefined);
    const notices = await db.notification.findMany({ where: { userId: owner.id } });
    assert.equal(notices.length, 1);
    assert.equal(notices[0].message, 'กรุณาแนบเอกสารที่อ่านเลขทะเบียนได้ชัดเจน');
    assert.equal(notices[0].link, '/company/profile#verification');
    assert.equal(notices[0].metadata.verificationId, pending.id);
    assert.equal(await db.notification.count({ where: { userId: colleague.id } }), 1);
    assert.equal(await db.notification.count({ where: { userId: inactive.id } }), 0);
    const resubmitted = await request('/company/verify', 'POST', body, token);
    assert.equal((await requestResult('/admin/verifications/' + pending.id + '/review', 'PUT', { action: 'APPROVE' }, adminToken)).status, 409);
    assert.equal((await db.company.findUnique({ where: { id: parallelCompany.id } })).verificationStatus, 'PENDING');
    await request('/admin/verifications/' + resubmitted.id + '/review', 'PUT', { action: 'APPROVE' }, adminToken);
    assert.equal((await requestResult('/company/verify', 'POST', body, token)).status, 409);
    assert.equal((await requestResult('/admin/verifications/' + resubmitted.id + '/review', 'PUT', { action: 'INVALID' }, adminToken)).status, 400);
    assert.equal((await db.company.findUnique({ where: { id: parallelCompany.id } })).verificationStatus, 'VERIFIED');
    assert.equal(await db.notification.count({ where: { userId: owner.id } }), 2);
  });
  await check('Submitted documents and rejected requests show their actual state', async () => {
    await submitCompanyDocuments();
    await screenshot('company-pending-review');
    await login('admin@smartcareer.dev', 'admin123', '/admin/dashboard');
    await goto('/admin/verifications');
    await clickText('ปฏิเสธ (Reject)');
    assert.equal(await page.$eval('textarea', el => el.checkValidity()), false);
    assert.equal((await db.company.findUnique({ where: { id: company.id } })).verificationStatus, 'PENDING');
    await fill('textarea', 'กรุณาแนบเอกสารที่อ่านเลขทะเบียนได้ชัดเจน');
    await clickText('ยืนยันการปฏิเสธ');
    await page.waitForFunction(() => document.body.innerText.includes('ดำเนินการ ปฏิเสธคำขอ'));
    assert.equal((await db.company.findUnique({ where: { id: company.id } })).verificationStatus, 'REJECTED');
    await login('hr@techcorp.co.th', 'password123', '/company/dashboard');
    await goto('/company/profile');
    await page.waitForFunction(() => document.body.innerText.includes('คำขอไม่ผ่านการตรวจสอบ'));
    await goto('/company/profile#verification');
    await page.waitForFunction(() => document.body.innerText.includes('กรุณาแนบเอกสารที่อ่านเลขทะเบียนได้ชัดเจน'));
    await page.waitForFunction(() => { const top = document.querySelector('#verification')?.getBoundingClientRect().top; return top >= 70 && top < 200; });
    const notices = await request('/notifications', 'GET', undefined, companyToken);
    assert(notices.some(notice => notice.message === 'กรุณาแนบเอกสารที่อ่านเลขทะเบียนได้ชัดเจน' && notice.link === '/company/profile#verification'));
    await screenshot('company-rejected');
  });
  await check('Resubmitted documents can be approved through the admin UI', async () => {
    await submitCompanyDocuments();
    await login('admin@smartcareer.dev', 'admin123', '/admin/dashboard');
    await goto('/admin/verifications');
    await clickText('อนุมัติ (Approve)');
    await page.waitForFunction(() => document.body.innerText.includes('ดำเนินการ อนุมัติการรับรอง'));
    assert.equal((await db.company.findUnique({ where: { id: company.id } })).verificationStatus, 'VERIFIED');
    assert.equal(await db.companyVerification.count({ where: { status: 'PENDING' } }), 0);
    companyToken = await login('hr@techcorp.co.th', 'password123', '/company/dashboard');
    await goto('/company/profile');
    await page.waitForFunction(() => document.body.innerText.includes('Verified Employer Active'));
    await screenshot('company-verified');
  });
  await check('Browser session is private and cross-site writes are refused', async () => {
    const me = await fetch('http://localhost:3000/api/auth/me', { headers: { Cookie: 'smartcareer_session=' + companyToken } });
    assert(me.ok); assert.equal((await me.json()).token, undefined);
    const blocked = await fetch('http://localhost:3000/api/auth/logout', { method: 'POST', headers: { Origin: 'https://unrelated.example' } });
    assert.equal(blocked.status, 403);
  });
  let documentFixture;
  let documentBytes;
  let verificationAdminToken;
  await check('Paginated verification metadata stays small despite many large documents', async () => {
    const fixtureCompany = await db.company.create({ data: { name: 'Paged document fixture', slug: databaseName + '-documents', verificationStatus: 'REJECTED' } });
    documentBytes = Buffer.alloc(3 * 1024 * 1024, 32);
    Buffer.from('%PDF-1.7\nDisposable regression fixture\n').copy(documentBytes);
    const documents = { files: [{ name: 'เอกสารทดสอบ "บริษัท".pdf', type: 'application/pdf', size: documentBytes.length, dataUrl: 'data:application/pdf;base64,' + documentBytes.toString('base64') }] };
    // Legacy document-bearing rows are deliberately big; metadata extraction
    // must not return their content or the list would exceed production limits.
    for (let i = 0; i < 24; i++) {
      const row = await db.companyVerification.create({ data: { companyId: fixtureCompany.id, businessRegNo: '1234567890123', status: 'REJECTED', documents, createdAt: new Date(Date.UTC(2020, 0, i + 1)) } });
      if (i === 23) documentFixture = row;
    }
    verificationAdminToken = (await request('/auth/login', 'POST', { email: 'admin@smartcareer.dev', password: 'admin123' })).token;
    const first = await request('/admin/verifications?paginated=true&page=1&pageSize=10', 'GET', undefined, verificationAdminToken);
    const second = await request('/admin/verifications?paginated=true&page=2&pageSize=10', 'GET', undefined, verificationAdminToken);
    assert.equal(first.total, await db.companyVerification.count());
    assert.equal(first.items.length, 10);
    assert.equal(first.pageCount, 3);
    assert.equal(first.counts.pending, 0);
    assert.equal(first.counts.verified, 2);
    assert.equal(first.counts.rejected, 26);
    assert.equal(second.page, 2);
    assert(!second.items.some(item => first.items.some(other => item.id === other.id)));
    assert(Buffer.byteLength(JSON.stringify(first)) < 50000);
    assert(!JSON.stringify(first).includes(';base64,'));
    assert(first.items.some(item => item.documents.files.some(file => file.downloadUrl?.includes('/documents/0'))));
    const rejected = await request('/admin/verifications?paginated=true&status=REJECTED&page=999&pageSize=10', 'GET', undefined, verificationAdminToken);
    assert.equal(rejected.page, 3);
    assert.equal(rejected.total, 26);
    assert(rejected.items.every(item => item.status === 'REJECTED'));
    assert.equal(rejected.counts.total, first.total);
    const legacy = await request('/admin/verifications', 'GET', undefined, verificationAdminToken);
    assert.equal(legacy.length, 20);
    assert(!JSON.stringify(legacy).includes(';base64,'));
    for (const query of ['page=-1', 'page=1.5', 'pageSize=51', 'status=INVALID']) {
      assert.equal((await requestResult('/admin/verifications?' + query, 'GET', undefined, verificationAdminToken)).status, 400);
    }
  });
  await check('Individual document downloads require admin access and preserve original file bytes', async () => {
    const endpoint = '/admin/verifications/' + documentFixture.id + '/documents/0';
    assert.equal((await requestResult(endpoint)).status, 401);
    assert.equal((await requestResult(endpoint, 'GET', undefined, companyToken)).status, 403);
    const forbiddenCandidate = (await request('/auth/login', 'POST', { email: 'candidate@smartcareer.dev', password: 'password123' })).token;
    assert.equal((await requestResult(endpoint, 'GET', undefined, forbiddenCandidate)).status, 403);
    const downloaded = await fetch('http://localhost:3000/api' + endpoint, { headers: { Cookie: 'smartcareer_session=' + verificationAdminToken } });
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get('content-type'), 'application/pdf');
    assert(downloaded.headers.get('content-disposition').startsWith('attachment;'));
    assert(downloaded.headers.get('content-disposition').includes(encodeURIComponent('เอกสารทดสอบ "บริษัท".pdf')));
    assert.equal(downloaded.headers.get('cache-control'), 'no-store');
    assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff');
    assert(Buffer.from(await downloaded.arrayBuffer()).equals(documentBytes));
    assert.equal((await requestResult(endpoint.replace(/\/0$/, '/99'), 'GET', undefined, verificationAdminToken)).status, 404);
    assert.equal((await requestResult(endpoint.replace(/\/0$/, '/-1'), 'GET', undefined, verificationAdminToken)).status, 400);
    assert.equal((await requestResult('/admin/verifications/missing/documents/0', 'GET', undefined, verificationAdminToken)).status, 404);
  });
  await check('Admin verification UI pages and filters the full queue without loading every file', async () => {
    await login('admin@smartcareer.dev', 'admin123', '/admin/dashboard');
    await goto('/admin/verifications');
    await page.waitForFunction(() => document.body.innerText.includes('ทั้งหมด (28)'));
    assert.equal(await page.$$eval('a[download]', elements => elements.length), 10);
    assert(await page.$$eval('a[download]', elements => elements.every(element => element.getAttribute('href').startsWith('/api/admin/verifications/'))));
    await clickText('หน้าถัดไป');
    await page.waitForFunction(() => document.body.innerText.includes('หน้า 2 / 3'));
    await screenshot('admin-verifications-page-2');
    await clickText('อนุมัติแล้ว (2)');
    await page.waitForFunction(() => document.body.innerText.includes('หน้า 1 / 1'));
    assert.equal(await page.$$eval('a[download]', elements => elements.length), 2);
    await clickText('รอการตรวจสอบ (0)');
    await page.waitForFunction(() => document.body.innerText.includes('ไม่พบคำขอรับรองในหมวดหมู่นี้'));
    await login('hr@techcorp.co.th', 'password123', '/company/dashboard');
  });
  await check('Legacy large-document review returns only the outcome and preserves attachments', async () => {
    const legacyCompany = await db.company.create({ data: { name: 'Legacy review fixture', slug: databaseName + '-legacy-review' } });
    const bytes = Buffer.alloc(4 * 1024 * 1024, 32);
    Buffer.from('%PDF-1.7\nLegacy test fixture\n').copy(bytes);
    const legacy = await db.companyVerification.create({ data: { companyId: legacyCompany.id, businessRegNo: '1234567890123', documents: { files: [{ name: 'legacy.pdf', type: 'application/pdf', size: bytes.length, dataUrl: 'data:application/pdf;base64,' + bytes.toString('base64') }] } } });
    const response = await fetch('http://localhost:3000/api/admin/verifications/' + legacy.id + '/review', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Cookie: 'smartcareer_session=' + verificationAdminToken }, body: JSON.stringify({ action: 'REJECT', reason: 'Disposable legacy fixture' }),
    });
    assert.equal(response.status, 200);
    const text = await response.text();
    assert(Buffer.byteLength(text) < 1000);
    const outcome = JSON.parse(text);
    assert.equal(outcome.status, 'REJECTED');
    assert.equal(outcome.documents, undefined);
    const preserved = await db.companyVerification.findUnique({ where: { id: legacy.id } });
    assert.equal(preserved.documents.files[0].dataUrl, legacy.documents.files[0].dataUrl);
    assert.equal((await db.company.findUnique({ where: { id: legacyCompany.id } })).verificationStatus, 'REJECTED');
  });
  await check('Company API rejects placeholder theory choices', async () => {
    const result = await requestResult('/company/assessments', 'POST', {
      title: 'Invalid regression assessment', type: 'THEORY', timeLimitMinutes: 30, passingScore: 70,
      questions: [{ title: 'Question', prompt: 'Choose the right answer.', points: 10, choices: [
        { text: 'ตัวเลือก 1', isCorrect: true }, { text: 'ตัวเลือก 2', isCorrect: false },
      ] }],
    }, companyToken);
    assert.equal(result.status, 400, 'Placeholder choices should be rejected by the API');
    assert.equal(await db.assessment.count({ where: { title: 'Invalid regression assessment' } }), 0, 'Invalid assessment was saved');
  });
  let job;
  await check('Create job through UI and verify database', async () => {
    await goto('/company/jobs/new');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('select option')).some(option => option.textContent === 'JavaScript (BACKEND)'));
    await fill('input[placeholder="เช่น Senior Full Stack Developer (Next.js & NestJS)"]', 'Regression Backend Engineer');
    await fill('textarea[placeholder="ระบุหน้าที่หลักในแต่ละวัน ความท้าทาย และโครงสร้างทีม..."]', 'Regression description for the main job posting flow.');
    await fill('textarea[placeholder="เช่น ประสบการณ์ 3 ปีขึ้นไป, ความเข้าใจในสถาปัตยกรรม Microservices..."]', 'JavaScript regression requirements.');
    report.jobFormBeforeSubmit = await page.$$eval('form input, form textarea', fields => fields.map(el => ({ type: el.type, required: el.required, length: el.value.length, valid: el.checkValidity() })));
    assert(await page.$eval('form', form => form.checkValidity()), 'The filled job form is invalid before submission');
    await page.evaluate(() => { window.__regressionClicks = []; document.addEventListener('click', e => window.__regressionClicks.push({ tag: e.target.tagName, text: e.target.textContent?.slice(0,80), x: e.clientX, y: e.clientY }), true); });
    await Promise.all([page.waitForFunction(() => location.pathname === '/company/dashboard'), activate('button[type="submit"]')]);
    job = await db.job.findFirst({ where: { title: 'Regression Backend Engineer', companyId: company.id }, include: { skills: true } });
    assert(job && job.isActive && job.skills.length === 1, 'UI job was not persisted correctly');
    await screenshot('job-created');
  });
  await check('Public job details show required and preferred skills with their actual minimum scores', async () => {
    const main = await db.jobSkill.findFirst({ where: { jobId: job.id }, include: { skill: true } });
    const another = await db.skill.findFirst({ where: { id: { not: main.skillId } } });
    const optional = await db.jobSkill.create({ data: { jobId: job.id, skillId: another.id, isRequired: false, minimumScore: 0 } });
    try {
      await goto('/jobs/' + job.id);
      await page.waitForSelector('[aria-labelledby="job-skill-requirements"] li');
      const texts = await page.$$eval('[aria-labelledby="job-skill-requirements"] li', rows => rows.map(row => row.innerText));
      assert.equal(texts.length, 2);
      assert(texts.some(text => text.includes(main.skill.name) && text.includes('ทักษะหลัก (Required)') && text.includes(`คะแนนขั้นต่ำ ${main.minimumScore}%`)));
      assert(texts.some(text => text.includes(another.name) && text.includes('ทักษะเสริม (Preferred)') && text.includes('คะแนนขั้นต่ำ 0%')));
      await screenshot('job-skill-requirements');
    } finally { await db.jobSkill.delete({ where: { id: optional.id } }); }
  });
  await check('Toggle job off and on through UI', async () => {
    await goto('/company/jobs');
    await Promise.all([page.waitForResponse(res => res.url().endsWith('/company/jobs/' + job.id + '/toggle') && res.request().method() === 'PATCH'), clickText('ปิดรับ')]);
    await goto('/company/jobs');
    assert.equal((await db.job.findUnique({ where: { id: job.id } })).isActive, false);
    await Promise.all([page.waitForResponse(res => res.url().endsWith('/company/jobs/' + job.id + '/toggle') && res.request().method() === 'PATCH'), clickText('เปิดรับ')]);
    await goto('/company/jobs');
    assert.equal((await db.job.findUnique({ where: { id: job.id } })).isActive, true);
  });
  let candidateToken;
  await check('Candidate login through UI', async () => { candidateToken = await login('candidate@smartcareer.dev', 'password123', '/profile'); assert.equal((await request('/auth/me', 'GET', undefined, candidateToken)).role, 'CANDIDATE'); await screenshot('candidate-login'); });
  await check('Invalid legacy assessment cannot start a timed attempt', async () => {
    invalidLegacyAssessment = await db.assessment.create({
      data: {
        title: 'Invalid Legacy Theory', slug: 'invalid-legacy-theory', type: 'THEORY', skillId: skill.id,
        questions: { create: { title: 'Placeholder question', prompt: 'Choose the right answer.', points: 10,
          choices: { create: [{ text: 'ตัวเลือก 1', isCorrect: true }, { text: 'ตัวเลือก 2', isCorrect: false }] } } },
      },
    });
    const result = await requestResult(`/assessments/${invalidLegacyAssessment.id}/start`, 'POST', {}, candidateToken);
    assert.equal(result.status, 400, 'Invalid stored content should be rejected before an attempt begins');
    assert.equal(await db.assessmentAttempt.count({ where: { assessmentId: invalidLegacyAssessment.id } }), 0, 'Invalid assessment created a timed attempt');
  });
  await check('Candidate sees a clear message for an invalid legacy assessment', async () => {
    expectedApiResponses.set(`/api/assessments/${invalidLegacyAssessment.id}/start`, 400);
    await goto('/assessments/' + invalidLegacyAssessment.id);
    const body = await page.$eval('body', el => el.innerText);
    assert(body.includes('ยังเปิดแบบทดสอบนี้ไม่ได้'), 'The assessment page did not explain why the test was blocked');
    assert(body.includes('เปลี่ยนข้อความตัวอย่างให้เป็นตัวเลือกคำตอบจริง'), 'The assessment page did not show a useful repair message');
    assert(!body.includes('เวลาที่เหลือ'), 'The page started a timer for an invalid assessment');
    assert.equal(await db.assessmentAttempt.count({ where: { assessmentId: invalidLegacyAssessment.id } }), 0, 'The UI created an attempt for invalid content');
    await screenshot('invalid-assessment-blocked');
  });
  let application;
  await check('Apply for job through UI and verify database', async () => {
    await goto('/jobs/' + job.id); await page.waitForSelector('#btn-apply-job'); await activate('#btn-apply-job'); await page.waitForSelector('form textarea');
    await fill('form textarea', 'Regression cover letter.');
    await Promise.all([page.waitForResponse(res => res.url().endsWith('/applications/' + job.id + '/apply') && res.request().method() === 'POST'), clickText('ยืนยันการสมัคร')]);
    await goto('/jobs/' + job.id);
    application = await db.jobApplication.findFirst({ where: { jobId: job.id, candidateId: candidate.candidateProfile.id }, include: { statusHistory: true } });
    assert(application && application.status === 'APPLIED' && application.statusHistory.length === 1, 'Application or status history was not stored'); await screenshot('application-submitted');
  });
  await check('Cancel and reapply as next round', async () => {
    const cancelled = await request('/applications/' + application.id, 'DELETE', undefined, candidateToken); assert.equal(cancelled.status, 'CANCELLED');
    const reapplied = await request('/applications/' + job.id + '/apply', 'POST', { coverLetter: 'Regression second round' }, candidateToken); assert.equal(reapplied.roundNumber, 2); application = reapplied;
    await goto('/applications'); assert((await page.$eval('body', el => el.innerText)).includes('Regression Backend Engineer')); await screenshot('application-tracking');
  });
  let companyAssessment;
  let companyAssessmentQuestion;
  await check('Company assessment is restricted to assigned applicants', async () => {
    companyAssessment = await db.assessment.create({
      data: {
        companyId: company.id, title: 'Regression Company Assessment', slug: 'regression-company-assessment',
        type: 'PRACTICAL_CODING', skillId: skill.id, timeLimitMinutes: 30,
        questions: { create: {
          title: 'Return a greeting', prompt: 'Write a solution that returns a greeting string.', points: 10,
          evaluationMethod: 'OPEN_ENDED', starterCode: 'function solution() { return "Hello"; }',
        } },
      }, include: { questions: true },
    });
    companyAssessmentQuestion = companyAssessment.questions[0];
    const denied = await requestResult(`/assessments/${companyAssessment.id}`, 'GET', undefined, candidateToken);
    assert.equal(denied.status, 403, 'Unassigned candidate should not read a company assessment');

    await db.jobApplication.update({ where: { id: application.id }, data: { assignedAssessmentId: companyAssessment.id } });
    const allowed = await requestResult(`/assessments/${companyAssessment.id}`, 'GET', undefined, candidateToken);
    assert.equal(allowed.status, 200, 'Assigned candidate should read the assessment');
    const started = await requestResult(`/assessments/${companyAssessment.id}/start`, 'POST', {}, candidateToken);
    assert([200, 201].includes(started.status), `Assigned candidate could not start the assessment: ${JSON.stringify(started.data)}`);

    const event = await requestResult(`/assessments/${companyAssessment.id}/integrity-event`, 'POST', {
      attemptId: started.data.id, event: { type: 'TAB_BLUR' },
    }, candidateToken);
    assert([200, 201].includes(event.status), 'Browser-reported visibility event was not recorded');
    const companyAttempts = await request(`/company/assessment-attempts?assessmentId=${companyAssessment.id}`, 'GET', undefined, companyToken);
    assert.equal(companyAttempts[0]?.integritySummary?.riskLevel, 'REVIEW', 'Browser telemetry must request contextual review instead of labeling a candidate suspicious');

    const unrelatedQuestion = await requestResult(`/assessments/${companyAssessment.id}/run-code`, 'POST', {
      attemptId: started.data.id, questionId: coding.questions[0].id, sourceCode: 'function solution() { return 1; }',
    }, candidateToken);
    assert.equal(unrelatedQuestion.status, 403, 'A code-run request must not execute a question outside its attempt');

    const changedContent = await requestResult(`/company/assessments/${companyAssessment.id}`, 'PUT', {
      title: companyAssessment.title, type: companyAssessment.type, timeLimitMinutes: 30, passingScore: 70,
      questions: [{ id: companyAssessmentQuestion.id, title: companyAssessmentQuestion.title,
        prompt: 'Changed scoring prompt after the candidate started.', points: 10,
        evaluationMethod: 'OPEN_ENDED', starterCode: companyAssessmentQuestion.starterCode,
        testCases: null, rubric: null, choices: [] }],
    }, companyToken);
    assert.equal(changedContent.status, 400, 'Question content must stay fixed after the first attempt');
  });
  await check('Theory selection autosaves and integrity event persists', async () => {
    await goto('/assessments/' + theory.id); await clickText('Correct regression answer');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    }); await pause(4000);
    const attempt = await db.assessmentAttempt.findFirst({ where: { assessmentId: theory.id, candidateId: candidate.candidateProfile.id } });
    assert(attempt && attempt.draftCode, 'Theory draft was not persisted after selecting an answer');
    assert.equal(attempt.draftCode.selectedChoices[theory.questions[0].id], theory.questions[0].choices.find(c => c.isCorrect).id);
    assert(Array.isArray(attempt.integrityEvents) && attempt.integrityEvents.some(e => e.type === 'TAB_BLUR'), 'Hidden-page integrity event was not persisted');
    assert(!attempt.integrityEvents.some(e => e.type === 'WINDOW_BLUR'), 'Window blur should not be counted as leaving the assessment');
    await goto('/assessments/' + theory.id);
    const restoredChoice = await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.innerText.includes('Correct regression answer') && b.className.includes('border-[#6366f1]')));
    assert(restoredChoice, 'Theory answer was not restored after reloading');
    await screenshot('theory-draft-restored');
  });
  await check('Submit theory through UI and persist score', async () => {
    await Promise.all([page.waitForResponse(res => res.url().endsWith('/assessments/' + theory.id + '/submit-theory') && res.request().method() === 'POST'), clickText('ส่งคำตอบและบันทึกคะแนน')]);
    await page.waitForFunction(() => document.body.innerText.includes('100'));
    const attempt = await db.assessmentAttempt.findFirst({ where: { assessmentId: theory.id }, include: { answers: true } }); assert.equal(attempt.status, 'COMPLETED'); assert.equal(attempt.percentage, 100); assert.equal(attempt.answers[0].isCorrect, true); await screenshot('theory-score');
  });
  await check('Coding submission through UI persists completed attempt and score', async () => {
    await goto('/assessments/' + coding.id);
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    const [response] = await Promise.all([page.waitForResponse(res => res.url().endsWith('/assessments/' + coding.id + '/submit-coding') && res.request().method() === 'POST', { timeout: 90000 }), clickText('ส่งคำตอบข้อนี้')]);
    assert(response.ok(), 'Coding UI submission failed');
    const answer = await response.json();
    assert.equal(answer.status, 'COMPLETED'); assert.equal(answer.score, 100);
    const stored = await db.assessmentAttempt.findFirst({ where: { assessmentId: coding.id, candidateId: candidate.candidateProfile.id }, include: { answers: true } }); assert.equal(stored.percentage, 100); assert.equal(stored.answers[0].isCorrect, true);
    report.codingExecution = answer.execution;
    await screenshot('coding-score');
  });
  await check('Company changes applicant status and candidate sees notification', async () => {
    await request('/company/applications/' + application.id + '/status', 'PUT', { status: 'REVIEWING', note: 'Regression review' }, companyToken);
    const stored = await db.jobApplication.findUnique({ where: { id: application.id }, include: { statusHistory: true } }); assert.equal(stored.status, 'REVIEWING'); assert.equal(stored.statusHistory.length, 2);
    const notifications = await request('/notifications', 'GET', undefined, candidateToken); assert(notifications.some(n => n.message.includes('Regression Backend Engineer')));
    await goto('/applications'); assert((await page.$eval('body', e => e.innerText)).includes('พิจารณา')); await screenshot('candidate-status-updated');
  });
  await check('Candidate withdrawal requires explicit in-app confirmation and preserves history', async () => {
    await clickText('ยกเลิกใบสมัคร');
    await page.waitForSelector('dialog[open]');
    await clickText('ยกเลิก');
    assert.equal((await db.jobApplication.findUnique({ where: { id: application.id } })).status, 'REVIEWING');
    await clickText('ยกเลิกใบสมัคร');
    await page.waitForSelector('dialog[open]');
    const [withdrawal] = await Promise.all([
      page.waitForResponse(res => res.url().endsWith('/applications/' + application.id) && res.request().method() === 'DELETE'),
      clickText('ยืนยันการยกเลิกใบสมัคร'),
    ]);
    assert(withdrawal.ok(), 'Confirmed withdrawal must finish successfully');
    assert.equal((await db.jobApplication.findUnique({ where: { id: application.id } })).status, 'CANCELLED');
    await screenshot('candidate-withdrawal-confirmed');
  });
  await check('Admin login and dashboard data', async () => { const token = await login('admin@smartcareer.dev', 'admin123', '/admin/dashboard'); const stats = await request('/admin/dashboard', 'GET', undefined, token); assert(stats && Object.keys(stats).length > 0); await screenshot('admin-dashboard'); });
  await check('Delete test job through UI', async () => {
    await login('hr@techcorp.co.th', 'password123', '/company/dashboard');
    await goto('/company/jobs');
    await clickText('ลบ');
    await page.waitForSelector('dialog[open]');
    await clickText('ยกเลิก');
    assert.equal(await db.job.count({ where: { id: job.id } }), 1);
    await clickText('ลบ');
    await page.waitForSelector('dialog[open]');
    await clickText('ยืนยันการลบ');
    report.deleteConfirmationMode = 'In-app dialog cancellation preserves job; explicit confirmation deletes disposable fixture';
    await page.waitForFunction(() => !document.body.innerText.includes('Regression Backend Engineer'));
    assert.equal(await db.job.count({ where: { id: job.id } }), 0);
  });
  await check('Closed-job cleanup preserves hired applications and status history, including legacy DELETE mode', async () => {
    const { JobScreeningService } = require('../apps/api/dist/ingestion/job-screening.service');
    const fixture=await db.job.create({data:{companyId:company.id,companyName:company.name,title:'Closed QA history fixture',slug:'closed-qa-history-fixture',description:'Isolated regression only',isActive:false}});
    const hired=await db.jobApplication.create({data:{jobId:fixture.id,candidateId:candidate.candidateProfile.id,status:'ACCEPTED',statusHistory:{create:{newStatus:'ACCEPTED',note:'QA retention proof'}}},include:{statusHistory:true}});
    const service=new JobScreeningService(db);
    await service.scanAndCleanJobs({source:'INTERNAL',limit:300,deleteMode:'DELETE'});
    assert(await db.job.findUnique({where:{id:fixture.id}}));
    assert.deepEqual(await db.jobApplication.findUnique({where:{id:hired.id},include:{statusHistory:true}}),hired);
    const history=await request('/candidate/applications','GET',undefined,candidateToken);
    assert(history.some(row=>row.id===hired.id && row.status==='ACCEPTED' && row.job.id===fixture.id));
  });
  await check('CSV export recovers from a failed request with an authenticated job-scoped download link', async () => {
    const fixture = await db.job.findFirstOrThrow({ where: { slug: 'closed-qa-history-fixture' } });
    await db.job.update({ where: { id: fixture.id }, data: { title: 'งาน CSV QA ทดสอบเท่านั้น' } });
    await login('hr@techcorp.co.th', 'password123', '/company/dashboard');
    await goto('/company/applications?jobId=' + fixture.id);
    await page.waitForSelector('#export-csv-btn');
    const endpoint = '/api/company/applications/export';
    let failExport = true;
    let dialogs = 0;
    const countDialog = () => { dialogs++; };
    const intercept = req => {
      if (new URL(req.url()).pathname === endpoint && failExport) {
        void req.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Isolated QA unavailable' }) });
      } else { void req.continue(); }
    };
    await page.setRequestInterception(true);
    page.on('request', intercept);
    page.on('dialog', countDialog);
    expectedApiResponses.set(endpoint, 503);
    try {
      await activate('#export-csv-btn');
      await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('ส่งออก CSV ไม่สำเร็จ'));
      assert.equal(dialogs, 0, 'Export failure must be visible in the page without a blocking alert');
      assert.equal(await page.$('a[download][href^="/api/company/applications/export"]'), null);
      failExport = false;
      expectedApiResponses.delete(endpoint);
      await activate('#export-csv-btn');
      await page.waitForSelector('a[download][href^="/api/company/applications/export"]');
      const href = await page.$eval('a[download][href^="/api/company/applications/export"]', e => e.getAttribute('href'));
      assert.equal(href, endpoint + '?jobId=' + fixture.id);
      const bytes = await page.evaluate(async href => Array.from(new Uint8Array(await (await fetch(href, { credentials: 'same-origin' })).arrayBuffer())), href);
      assert.deepEqual(bytes.slice(0, 3), [239, 187, 191], 'Excel download must preserve the UTF-8 BOM');
      const csv = Buffer.from(bytes).toString('utf8');
      assert(csv.includes('งาน CSV QA ทดสอบเท่านั้น') && csv.includes('"ACCEPTED"'));
      assert.equal(csv.trim().split('\r\n').length, 2, 'The selected job exports exactly one application');
      fs.writeFileSync(path.join(evidenceDir, 'job-scoped-export.csv'), Buffer.from(bytes));
      await screenshot('csv-retry-ready');
    } finally {
      expectedApiResponses.delete(endpoint);
      page.off('request', intercept);
      page.off('dialog', countDialog);
      await page.setRequestInterception(false);
    }
  });
  await check('No browser runtime exceptions', async () => assert.equal(pageErrors.length, 0, pageErrors.join('; ')));
  await check('No failed browser API requests', async () => assert.equal(apiFailures.length, 0, JSON.stringify(apiFailures)));
  await check('Configured database remains unchanged', async () => assert.deepEqual({ users: await admin.user.count(), jobs: await admin.job.count(), attempts: await admin.assessmentAttempt.count() }, sourceCounts));
}

(async () => {
  try { await run(); report.verdict = 'PASS'; }
  catch (error) {
    report.verdict = 'FAIL'; report.failure = error.message; console.error('FAIL: ' + error.message);
    if (page) report.clickEvidence = await page.evaluate(() => window.__regressionClicks || []).catch(() => []);
    if (page) { await screenshot('failure').catch(() => {}); fs.writeFileSync(path.join(evidenceDir, 'failure-page.txt'), await page.$eval('body', el => el.innerText).catch(() => 'Unavailable')); }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (keepManualUi && report.verdict === 'PASS') {
      console.log('Manual UI session is ready at http://localhost:3000');
      console.log('Local test accounts: hr@techcorp.co.th / password123 and candidate@smartcareer.dev / password123');
      console.log('Press Ctrl+C when the manual UI checks are complete; this will stop both servers and remove the isolated database.');
      await new Promise(resolve => {
        const timer = setInterval(() => { if (fs.existsSync(path.join(evidenceDir, 'stop-manual-ui'))) { clearInterval(timer); resolve(); } }, 500);
        process.once('SIGINT', () => { clearInterval(timer); resolve(); });
      });
    }
    for (const child of children.reverse()) { if (child.exitCode === null) { child.kill(); await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(3000)]); } }
    if (judgeFixture) await new Promise(resolve => judgeFixture.close(resolve));
    for (const fd of logs) fs.closeSync(fd);
    await db.$disconnect();
    if (created) {
      assert(/^smartcareer_regression_\d+$/.test(databaseName) && testUrl.href !== sourceUrl.href, 'Refusing to drop a non-test database');
      await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`); report.cleanedUp = true;
    }
    await admin.$disconnect(); report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(report, null, 2));
    console.log('Evidence: ' + evidenceDir);
  }
})();
