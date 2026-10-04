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
    if (await handle.evaluate((el, text) => !el.disabled && el.innerText.includes(text), text)) { await handle.click(); return; }
  }
  throw new Error('Button missing: ' + text);
}
async function goto(route) { await page.goto('http://localhost:3000' + route, { waitUntil: 'networkidle2', timeout: 30000 }); assert((await page.$eval('body', e => e.innerText)).length > 50, 'Page was blank: ' + route); }
async function fill(selector, value) {
  await page.bringToFront();
  await page.locator(selector).click();
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
  await Promise.all([page.waitForFunction(route => location.pathname === route, { timeout: 20000 }, landing), page.click('button[type="submit"]')]);
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
  const company = await db.company.create({ data: { name: 'Regression Test Company', slug: databaseName, verificationStatus: 'VERIFIED', members: { create: { userId: employer.id, role: 'OWNER' } } } });
  const skill = await db.skill.create({ data: { name: 'JavaScript', slug: 'javascript', category: 'BACKEND' } });
  await db.candidateSkill.create({ data: { candidateId: candidate.candidateProfile.id, skillId: skill.id, practicalScore: 80 } });
  const theory = await db.assessment.create({ data: { title: 'Regression Theory', slug: 'regression-theory', type: 'THEORY', skillId: skill.id, questions: { create: { title: 'Regression choice', prompt: 'Choose the correct regression answer.', points: 10, choices: { create: [{ text: 'Correct regression answer', isCorrect: true, order: 0 }, { text: 'Incorrect regression answer', isCorrect: false, order: 1 }] } } } }, include: { questions: { include: { choices: true } } } });
  const coding = await db.assessment.create({ data: { title: 'Regression Coding', slug: 'regression-coding', type: 'PRACTICAL_CODING', skillId: skill.id, questions: { create: { title: 'Add two numbers', prompt: 'Implement function solution(a, b) returning their sum.', points: 100, starterCode: 'function solution(a, b) { return a + b; }', testCases: [{ input: '[2,3]', expectedOutput: '5', isHidden: false }, { input: '[10,20]', expectedOutput: '30', isHidden: true }] } } }, include: { questions: true } });
  const apiChild = launch('api', [path.join(root, 'apps/api/dist/main.js')], root);
  await waitReady('http://localhost:4000/api/health', apiChild);
  const webChild = launch('web', [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', '3000'], path.join(root, 'apps/web'), { NODE_ENV: 'production' });
  await waitReady('http://localhost:3000/login', webChild);
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : '/usr/bin/google-chrome');
  browser = await puppeteer.launch({ executablePath, headless: true, args: process.env.CI ? ['--no-sandbox'] : [], defaultViewport: { width: 1366, height: 900 } });
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
  page.on('dialog', dialog => dialog.accept());
  await check('Home and login pages render', async () => { await goto('/'); await screenshot('home'); await goto('/login'); assert(await page.$('input[type="email"]')); });
  let companyToken;
  let invalidLegacyAssessment;
  await check('Company login through UI', async () => { companyToken = await login('hr@techcorp.co.th', 'password123', '/company/dashboard'); await screenshot('company-login'); assert.equal((await request('/auth/me', 'GET', undefined, companyToken)).role, 'COMPANY'); });
  await check('Browser session is private and cross-site writes are refused', async () => {
    const me = await fetch('http://localhost:3000/api/auth/me', { headers: { Cookie: 'smartcareer_session=' + companyToken } });
    assert(me.ok); assert.equal((await me.json()).token, undefined);
    const blocked = await fetch('http://localhost:3000/api/auth/logout', { method: 'POST', headers: { Origin: 'https://unrelated.example' } });
    assert.equal(blocked.status, 403);
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
    await Promise.all([page.waitForFunction(() => location.pathname === '/company/dashboard'), page.click('button[type="submit"]')]);
    job = await db.job.findFirst({ where: { title: 'Regression Backend Engineer', companyId: company.id }, include: { skills: true } });
    assert(job && job.isActive && job.skills.length === 1, 'UI job was not persisted correctly');
    await screenshot('job-created');
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
    await goto('/jobs/' + job.id); await page.waitForSelector('#btn-apply-job'); await page.click('#btn-apply-job'); await page.waitForSelector('form textarea');
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
  await check('Admin login and dashboard data', async () => { const token = await login('admin@smartcareer.dev', 'admin123', '/admin/dashboard'); const stats = await request('/admin/dashboard', 'GET', undefined, token); assert(stats && Object.keys(stats).length > 0); await screenshot('admin-dashboard'); });
  await check('Delete test job through UI', async () => { await login('hr@techcorp.co.th', 'password123', '/company/dashboard'); await goto('/company/jobs'); await clickText('ลบ'); await page.waitForFunction(() => !document.body.innerText.includes('Regression Backend Engineer')); assert.equal(await db.job.count({ where: { id: job.id } }), 0); });
  await check('No browser runtime exceptions', async () => assert.equal(pageErrors.length, 0, pageErrors.join('; ')));
  await check('No failed browser API requests', async () => assert.equal(apiFailures.length, 0, JSON.stringify(apiFailures)));
  await check('Configured database remains unchanged', async () => assert.deepEqual({ users: await admin.user.count(), jobs: await admin.job.count(), attempts: await admin.assessmentAttempt.count() }, sourceCounts));
}

(async () => {
  try { await run(); report.verdict = 'PASS'; }
  catch (error) {
    report.verdict = 'FAIL'; report.failure = error.message; console.error('FAIL: ' + error.message);
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
