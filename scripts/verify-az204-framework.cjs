// Integration checks use a fresh LOCAL database only. No existing database is migrated or seeded.
// Prerequisites: npm run build, local DATABASE_URL in root .env, Chrome/Edge or QA_BROWSER_PATH.
// Browser /api requests use real services + PostgreSQL through an isolated transport;
// AI and sandbox execution are fixtures. This does not test production OAuth or the AI provider.
require('reflect-metadata');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { ValidationPipe } = require('@nestjs/common');
const { AdminService } = require('../apps/api/dist/admin/admin.service');
const { CompanyService } = require('../apps/api/dist/company/company.service');
const { AssessmentsService } = require('../apps/api/dist/assessments/assessments.service');
const { CompanyAssessmentDto } = require('../apps/api/dist/company/dto/assessment.dto');
const { fixture } = require('../tests/fixtures/az204.cjs');

const root = path.resolve(__dirname, '..');
const configuration = require('dotenv').parse(fs.readFileSync(path.join(root, '.env')));
const source = new URL(configuration.DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname), 'Only local PostgreSQL is allowed');
const database = `smartcareer_az204_${Date.now()}`;
assert(/^smartcareer_az204_\d+$/.test(database));
const target = new URL(source); target.pathname = '/' + database;
const adminDb = new PrismaClient({ datasources: { db: { url: source.href } } });
const db = new PrismaClient({ datasources: { db: { url: target.href } } });
const dir = path.join(root, 'outputs', 'az204-framework', database);
fs.mkdirSync(dir, { recursive: true });
const report = { startedAt: new Date().toISOString(), isolatedLocalDatabase: true,
  browserTransport: 'Browser requests are routed to real services with isolated PostgreSQL and DTO validation',
  aiExecution: 'AI and sandbox are fixtures; no live model or Azure execution was tested',
  productionDeployed: false, results: [], cleanedUp: false };
let created = false, browser, server, logFd;
const pause = ms => new Promise(r => setTimeout(r, ms));
async function check(name, fn) { await fn(); report.results.push({ name, status: 'PASS' }); console.log('PASS: ' + name); }

async function main() {
  await adminDb.$executeRawUnsafe(`CREATE DATABASE "${database}"`); created = true;
  const pushed = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'db', 'push', '--schema', path.join(root, 'prisma/schema.prisma'), '--skip-generate'], {
    cwd: root, env: { ...process.env, DATABASE_URL: target.href }, windowsHide: true, encoding: 'utf8', timeout: 120000,
  });
  assert.equal(pushed.status, 0, 'Schema push into the isolated database failed');
  const owner = await db.user.create({ data: { email: 'az204-company@example.test', role: 'COMPANY' } });
  const otherOwner = await db.user.create({ data: { email: 'az204-other@example.test', role: 'COMPANY' } });
  const company = await db.company.create({ data: { name: 'AZ204 QA', slug: 'az204-qa', members: { create: { userId: owner.id } } } });
  await db.company.create({ data: { name: 'Other QA', slug: 'other-qa', members: { create: { userId: otherOwner.id } } } });
  const candidate = await db.user.create({ data: { email: 'az204-candidate@example.test', role: 'CANDIDATE', candidateProfile: { create: { fullName: 'AZ204 QA Candidate' } } }, include: { candidateProfile: true } });
  const skill = await db.skill.create({ data: { name: 'Azure QA', slug: 'azure-qa', category: 'DEVOPS' } });
  const admin = new AdminService(db), recruiter = new CompanyService(db);
  let aiPayload;
  const candidateService = new AssessmentsService(db,
    { executeRaw: async () => ({ status: 'SUCCESS', stdout: 'QA fixture only', stderr: null, compileOutput: null }) },
    { evaluate: async payload => { aiPayload = payload; return { result: { overallScore: 80, summaryReview: 'Isolated fixture, not a live AI assessment' }, model: 'qa-fixture', provider: 'qa-fixture', promptVersion: 'qa-fixture' }; } });
  let assessment;
  await check('Company creation persists version, scope and all 11 question mappings in PostgreSQL', async () => {
    assessment = await recruiter.createCompanyAssessment(owner.id, { ...fixture(), skillId: skill.id });
    assert.equal(assessment.frameworkVersion, '2026-01-14');
    assert.equal(assessment.questions.length, 11);
    const loaded = await recruiter.getCompanyAssessmentDetail(owner.id, assessment.id);
    assert.equal(loaded.frameworkCoverage.meetsBlueprint, true);
    assert.equal(loaded.questions[0].frameworkMappingNote, fixture().questions[0].frameworkMappingNote);
    assert.equal((await recruiter.listCompanyAssessments(owner.id))[0].frameworkCoverage.coveredTopics, 11);
  });
  await check('Partial metadata updates keep the reference and question mappings', async () => {
    await recruiter.updateCompanyAssessment(owner.id, assessment.id, { title: 'QA renamed AZ204' });
    const loaded = await recruiter.getCompanyAssessmentDetail(owner.id, assessment.id);
    assert.equal(loaded.frameworkCode, 'AZ-204');
    assert.equal(loaded.frameworkCoverage.meetsBlueprint, true);
  });
  await check('Company ownership and candidate assignment gates remain enforced', async () => {
    await assert.rejects(recruiter.getCompanyAssessmentDetail(otherOwner.id, assessment.id), e => e.getStatus() === 403);
    await assert.rejects(recruiter.updateCompanyAssessment(otherOwner.id, assessment.id, { title: 'bad' }), e => e.getStatus() === 403);
    await assert.rejects(candidateService.startAttempt(assessment.id, candidate.id), e => e.getStatus() === 403);
  });
  const job = await db.job.create({ data: { companyId: company.id, companyName: company.name, title: 'QA Azure role', slug: 'qa-azure-role', description: 'Isolated fixture', customAssessmentId: assessment.id } });
  await db.jobApplication.create({ data: { candidateId: candidate.candidateProfile.id, jobId: job.id } });
  let attempt;
  await check('Candidate view hides mapping notes; start snapshots the exact framework and coverage', async () => {
    const detail = await candidateService.findOne(assessment.id, candidate.id);
    assert.equal(detail.frameworkCoverage.meetsBlueprint, true);
    assert(detail.questions.every(q => !('frameworkMappingNote' in q) && !('solutionCode' in q)));
    attempt = await candidateService.startAttempt(assessment.id, candidate.id);
    assert.equal(attempt.snapshot.frameworkVersion, '2026-01-14');
    assert.equal(attempt.snapshot.frameworkCoverage.coveredTopics, 11);
    assert(attempt.snapshot.questions.every(q => q.frameworkTopicId));
  });
  await check('Both admin and company reject reference and mapping changes after a candidate starts', async () => {
    const loaded = await recruiter.getCompanyAssessmentDetail(owner.id, assessment.id);
    const changed = loaded.questions.map((q, i) => i === 0 ? { ...q, frameworkMappingNote: 'Changed alignment explanation after the candidate started' } : q);
    for (const update of [data => recruiter.updateCompanyAssessment(owner.id, assessment.id, data), data => admin.updateAssessment(assessment.id, data)]) {
      await assert.rejects(update({ frameworkScope: 'TOPIC_PRACTICE' }), e => e.getStatus() === 400);
      await assert.rejects(update({ questions: changed }), e => e.getStatus() === 400);
    }
    assert.equal((await db.assessment.findUnique({ where: { id: assessment.id } })).frameworkScope, 'FULL_BLUEPRINT');
  });
  await check('Company answers stay ungraded and never call AI; owner review is isolated and publishes feedback', async () => {
    await candidateService.submitCodingSolution(attempt.id, assessment.questions[0].id, candidate.id, 'console.log("QA");', 'QA design rationale');
    assert.equal(aiPayload, undefined);
    let saved = await db.assessmentAttempt.findUnique({where:{id:attempt.id}});
    assert.equal(saved.score,null);assert.equal(saved.reviewStatus,'PENDING_HUMAN_REVIEW');
    await assert.rejects(candidateService.overrideAttemptScore(attempt.id,owner.id,80,'QA'),e=>e.getStatus()===400);
    await candidateService.finalizeAttempt(attempt.id,candidate.id);
    await assert.rejects(candidateService.overrideAttemptScore(attempt.id,otherOwner.id,80,'QA'),e=>e.getStatus()===403);
    await assert.rejects(candidateService.overrideAttemptScore(attempt.id,owner.id,NaN,'QA'),e=>e.getStatus()===400);
    await candidateService.overrideAttemptScore(attempt.id,owner.id,80,'Internal QA reason','Practice Azure bindings');
    saved = await db.assessmentAttempt.findUnique({where:{id:attempt.id}});
    assert.equal(saved.humanScore,80);assert.equal(saved.aiScore,null);
    assert.equal((await candidateService.getCandidateAttempts(candidate.id))[0].reviewFeedback,'Practice Azure bindings');
    assert.equal((await candidateService.getCandidateBadges(candidate.id)).length,0);
    assert.equal(await db.notification.count({where:{userId:candidate.id}}),1);
  });
  await check('Platform AI receives pinned framework; outage retry uses immutable saved answers and issues platform badge',async()=>{
    const platform = await admin.createAssessment({...fixture(),title:'Platform retry QA',frameworkScope:'TOPIC_PRACTICE',questions:[fixture().questions[0]]});
    const round=await candidateService.startAttempt(platform.id,candidate.id);
    let fail=true,calls=0;
    candidateService.aiEvaluator={evaluate:async payload=>{calls++;aiPayload=payload;if(fail)throw Error('Isolated outage');return{result:{overallScore:80},model:'fixture',provider:'fixture',promptVersion:'fixture'};}};
    await candidateService.submitCodingSolution(round.id,platform.questions[0].id,candidate.id,'console.log("immutable QA")','Original reasoning');
    let saved=await db.assessmentAttempt.findUnique({where:{id:round.id}});
    assert.equal(saved.reviewStatus,'EVALUATION_PENDING');assert.equal(saved.score,null);
    assert.equal(saved.maxScore,platform.questions[0].points);
    fail=false;
    await candidateService.retryPlatformEvaluation(round.id,candidate.id);
    saved=await db.assessmentAttempt.findUnique({where:{id:round.id}});
    assert.equal(saved.percentage,80);assert.equal(saved.reviewStatus,'NOT_REQUIRED');assert.equal(calls,2);
    assert.equal(aiPayload.sourceCode,'console.log("immutable QA")');assert.equal(aiPayload.candidateExplanation,'Original reasoning');
    assert.equal(aiPayload.frameworkReference.code,'AZ-204');
    assert.equal((await candidateService.getCandidateBadges(candidate.id)).length,1);
    await assert.rejects(candidateService.retryPlatformEvaluation(round.id,candidate.id),e=>e.getStatus()===400);
  });
  await check('Admin creation and question replacement retain framework mappings', async () => {
    const input = fixture(); input.title = 'QA admin AZ204';
    const saved = await admin.createAssessment(input);
    const loaded = await admin.getAssessment(saved.id);
    await admin.updateAssessment(saved.id, { questions: loaded.questions.map(q => ({ ...q, frameworkMappingNote: 'Updated author rationale before anybody has started this question.' })) });
    assert.equal((await admin.getAssessment(saved.id)).frameworkCoverage.meetsBlueprint, true);
  });
  await check('Company theory waits for review, while platform theory grades from its answer key without AI',async()=>{
    for(const companyId of [company.id,null]) {
      const exam=await admin.createAssessment({title:companyId?'Company theory QA':'Platform theory QA',companyId,type:'THEORY',timeLimitMinutes:10,passingScore:70,questions:[{title:'Sum',prompt:'1 + 2 = ?',points:50,choices:[{text:'3',isCorrect:true},{text:'4',isCorrect:false}]}]});
      if(companyId)await db.job.update({where:{id:job.id},data:{customAssessmentId:exam.id}});
      const round=await candidateService.startAttempt(exam.id,candidate.id);
      const q=await db.question.findUnique({where:{id:exam.questions[0].id},include:{choices:true}});
      const result=await candidateService.submitTheoryAttempt(round.id,candidate.id,[{questionId:q.id,selectedChoiceId:q.choices.find(c=>c.isCorrect).id}]);
      assert.equal(result.maxScore,50);assert.equal(result.score,companyId?null:50);
      assert.equal(result.reviewStatus,companyId?'PENDING_HUMAN_REVIEW':'NOT_REQUIRED');
      const answer=await db.assessmentAnswer.findFirst({where:{attemptId:round.id}});
      assert.equal(answer.pointsEarned,companyId?0:50);
      if(companyId){await candidateService.overrideAttemptScore(round.id,owner.id,50,'QA partial credit','Practice');
        assert.equal((await db.assessmentAttempt.findUnique({where:{id:round.id}})).score,25);}
    }
    await db.job.update({where:{id:job.id},data:{customAssessmentId:assessment.id}});
  });
  await check('Invalid full-coverage content is rejected on create, update, activation and attempt start', async () => {
    const broken = fixture(); broken.questions = broken.questions.slice(1);
    await assert.rejects(admin.createAssessment(broken), e => e.getStatus() === 400);
    await assert.rejects(recruiter.createCompanyAssessment(owner.id, broken), e => e.getStatus() === 400);
    const saved = await admin.createAssessment({ ...fixture(), title: 'QA broken reference' });
    await assert.rejects(admin.updateAssessment(saved.id, { questions: saved.questions.slice(1) }), e => e.getStatus() === 400);
    // Simulate an inconsistent legacy record ONLY inside the isolated test database.
    await db.question.update({ where: { id: saved.questions[0].id }, data: { frameworkTopicId: null } });
    assert(!(await candidateService.findAll()).some(a => a.id === saved.id));
    await assert.rejects(candidateService.startAttempt(saved.id, candidate.id), e => e.getStatus() === 400);
    assert.equal(await db.assessmentAttempt.count({ where: { assessmentId: saved.id } }), 0);
    await db.assessment.update({ where: { id: saved.id }, data: { isActive: false } });
    await assert.rejects(admin.toggleAssessment(saved.id), e => e.getStatus() === 400);
  });
  await check('Reference can be removed before attempts; ordinary assessments still work', async () => {
    const saved = await admin.createAssessment({ ...fixture(), title: 'QA remove reference' });
    await admin.updateAssessment(saved.id, { frameworkCode: null, frameworkVersion: null, frameworkScope: null,
      questions: saved.questions.map(q => ({ ...q, frameworkTopicId: null, frameworkMappingNote: null })) });
    const detail = await admin.getAssessment(saved.id);
    assert.equal(detail.frameworkCoverage, null);
    assert.equal(detail.frameworkCode, null);
  });

  if (process.argv.includes('--ui')) {
    const port = 3107;
    await new Promise((resolve, reject) => { const probe = net.createServer(); probe.on('error', reject); probe.listen(port, '127.0.0.1', () => probe.close(resolve)); });
    logFd = fs.openSync(path.join(dir, 'web.log'), 'w');
    server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port)], {
      cwd: path.join(root, 'apps/web'), env: { ...process.env, API_URL: 'http://127.0.0.1:1/api', NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', logFd, logFd],
    });
    let ready = false;
    for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${port}/login`)).ok) { ready = true; break; } } catch {} await pause(500); }
    assert(ready, 'Local web server did not start');
    const executablePath = [process.env.QA_BROWSER_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
    browser = await require('puppeteer').launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const page = await browser.newPage(); await page.setViewport({ width: 1365, height: 1000 });
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(25000);
    const uiErrors = [];
    page.on('pageerror', e => uiErrors.push(e.message));
    page.on('dialog', async dialog => { uiErrors.push(dialog.message()); await dialog.dismiss(); });
    let role = 'COMPANY', latestSaved;
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    await page.setRequestInterception(true);
    page.on('request', async req => {
      const url = new URL(req.url());
      if (url.hostname !== 'localhost') return req.abort();
      if (!url.pathname.startsWith('/api/')) return req.continue();
      let status = 200, data;
      try {
        const route = url.pathname.slice(4), method = req.method();
        if (route === '/auth/me') data = { id: owner.id, email: owner.email, role, company: { id: company.id, name: company.name } };
        else if (route === '/skills' || route === '/admin/skills') data = [skill];
        else if (route.startsWith('/notifications')) data = route.includes('unread') ? { count: 0 } : [];
        else if (route === '/company/assessments' && method === 'GET') data = await recruiter.listCompanyAssessments(owner.id);
        else if (route === '/admin/assessments' && method === 'GET') data = await admin.listAssessments();
        else if (['/company/assessments', '/admin/assessments'].includes(route) && method === 'POST') {
          let input = JSON.parse(req.postData());
          if (role === 'COMPANY') input = await pipe.transform(input, { type: 'body', metatype: CompanyAssessmentDto });
          data = role === 'COMPANY' ? await recruiter.createCompanyAssessment(owner.id, input) : await admin.createAssessment(input);
          latestSaved = data;
        } else if (/^\/(company|admin)\/assessments\/[^/]+$/.test(route) && method === 'GET') {
          const id = route.split('/').pop(); data = role === 'COMPANY' ? await recruiter.getCompanyAssessmentDetail(owner.id, id) : await admin.getAssessment(id);
        } else if (route === '/assessments/my-attempts' && method === 'GET') data = await candidateService.getCandidateAttempts(candidate.id);
        else if (route.startsWith('/assessments/') && method === 'GET') data = await candidateService.findOne(route.split('/').pop(), candidate.id);
        else { status = 404; data = { message: 'Unconfigured isolated test route' }; }
      } catch (e) { status = e.getStatus?.() || 500; data = { message: e.message }; }
      await req.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });
    });
    const clickText = async text => {
      await page.waitForFunction(t => [...document.querySelectorAll('button')].some(b => b.textContent.includes(t)), {}, text);
      const buttons = await page.$$('button');
      for (const button of buttons) if (await button.evaluate((b, t) => b.textContent.includes(t), text)) { await button.click(); return; }
      throw new Error('Button not found');
    };
    const fill = async (selector, value) => { const el = await page.waitForSelector(selector); await el.click({ clickCount: 3 }); await el.type(value); };
    for (const scopeRole of ['COMPANY', 'ADMIN']) {
      role = scopeRole;
      await check(`${role} browser authoring validates full scope, saves topic practice and reloads mapping from PostgreSQL`, async () => {
        latestSaved = null;
        await page.goto(`http://localhost:${port}/${role.toLowerCase()}/assessments`, { waitUntil: 'domcontentloaded' });
        await clickText(role === 'COMPANY' ? 'สร้างแบบทดสอบคัดกรองใหม่' : 'สร้างแบบทดสอบใหม่');
        await page.select('select[id$="-framework"]', 'AZ-204');
        // Both editors expose type selection. Use a free-response coding task.
        for (const typeSelect of await page.$$('form select')) {
          if (await typeSelect.evaluate(el => [...el.options].some(o => o.value === 'PRACTICAL_CODING'))) await typeSelect.select('PRACTICAL_CODING');
        }
        const form = await page.$('form');
        const textInputs = await form.$$('input[type="text"]');
        await textInputs[0].type(`QA UI ${role} AZ204`);
        await fill(role === 'ADMIN' ? 'input[placeholder^="เช่น Two Sum"]' : 'input[placeholder^="เช่น Database Optimization"]', 'QA managed identity task');
        const prompt = await page.$('textarea[placeholder^="โจทย์หรือคำอธิบาย"]');
        assert(prompt, 'Question prompt input must be available');
        await prompt.type('Design an Azure Function that reads a secret from Key Vault using Managed Identity. Explain how access is scoped and errors handled.');
        // Admin retains the legacy test-case mode; explicitly choose open-ended.
        if (role === 'ADMIN') await clickText('โจทย์อิสระ (AI Rubric 4 มิติ)');
        await page.select('select[id$="-topic"]', 'security.secrets');
        await fill('textarea[id$="-note"]', 'Evaluate use of Managed Identity and Key Vault access without hard-coded secrets, including denied-access handling.');
        await page.select('select[id$="-scope"]', 'FULL_BLUEPRINT');
        await page.click('form button[type="submit"]');
        await page.waitForSelector('[role="alert"]');
        assert.equal(latestSaved, null, 'Incomplete blueprint must not reach persistence');
        const validationMessage = await page.$eval('[role="alert"]', el => el.textContent);
        assert(validationMessage.includes('ครบ 11'), validationMessage);
        await page.screenshot({ path: path.join(dir, `${role.toLowerCase()}-coverage-validation.png`), fullPage: true });
        await page.select('select[id$="-scope"]', 'TOPIC_PRACTICE');
        await page.click('form button[type="submit"]');
        for (let i = 0; i < 50 && !latestSaved; i++) await pause(100);
        assert(latestSaved, 'Browser save must reach the real service and local database');
        const persisted = await db.assessment.findUnique({ where: { id: latestSaved.id }, include: { questions: true } });
        assert.equal(persisted.frameworkScope, 'TOPIC_PRACTICE');
        assert.equal(persisted.questions[0].frameworkTopicId, 'security.secrets');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(title => document.body.textContent.includes(title), {}, `QA UI ${role} AZ204`);
        const editFound = await page.evaluate(title => {
          const buttons = [...document.querySelectorAll('button[title^="แก้ไข"]')];
          const candidates = buttons.map(button => {
            let parent = button.parentElement;
            for (let depth = 0; parent && depth < 4; depth++, parent = parent.parentElement) {
              if (parent.textContent.includes(title)) return { button, depth };
            }
            return { button, depth: 100 };
          }).sort((a, b) => a.depth - b.depth);
          const target = candidates[0]?.depth < 100 ? candidates[0].button : null;
          target?.click(); return Boolean(target);
        }, `QA UI ${role} AZ204`);
        assert(editFound, 'Saved assessment must be editable');
        await page.waitForSelector('select[id$="-framework"]');
        assert.equal(await page.$eval('select[id$="-scope"]', el => el.value), 'TOPIC_PRACTICE');
        assert.equal(await page.$eval('select[id$="-topic"]', el => el.value), 'security.secrets');
        assert((await page.$eval('textarea[id$="-note"]', el => el.value)).includes('Managed Identity'));
        await page.screenshot({ path: path.join(dir, `${role.toLowerCase()}-saved.png`), fullPage: true });
      });
    }
    role = 'CANDIDATE';
    await check('Candidate browser displays the pinned reference and retirement notice without author-only rationale', async () => {
      // Completed QA result fixture avoids loading external editor assets; no actual score is claimed.
      const candidateAttempt = await candidateService.startAttempt(latestSaved.id, candidate.id);
      const maxScore = latestSaved.questions.reduce((sum, q) => sum + q.points, 0);
      await db.assessmentAttempt.update({ where: { id: candidateAttempt.id }, data: {
        status: 'COMPLETED', score: maxScore * 0.8, maxScore, percentage: 80, passed: true, completedAt: new Date(),
      } });
      await page.goto(`http://localhost:${port}/assessments/${latestSaved.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[aria-label="ความครอบคลุม AZ-204"]');
      const content = await page.$eval('body', el => el.textContent);
      assert(content.includes('2026-01-14') && content.includes('2026-07-31'));
      assert(content.includes('1/11'));
      assert(!content.includes('Evaluate use of Managed Identity and Key Vault access without hard-coded secrets'));
      await page.screenshot({ path: path.join(dir, 'candidate-reference.png'), fullPage: true });
      await page.setViewport({ width: 390, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile reference view must not overflow');
      await page.screenshot({ path: path.join(dir, 'candidate-reference-mobile.png'), fullPage: true });
    });
    assert.deepEqual(uiErrors, []);
  }
}

main().catch(e => { report.error = e.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED]'); console.error(report.error); process.exitCode = 1; })
  .finally(async () => {
    await browser?.close();
    if (server) { server.kill(); await pause(500); }
    if (logFd !== undefined) fs.closeSync(logFd);
    await db.$disconnect();
    if (created) { await adminDb.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`); report.cleanedUp = true; }
    await adminDb.$disconnect();
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`Report: ${path.relative(root, path.join(dir, 'report.json'))}`);
  });
