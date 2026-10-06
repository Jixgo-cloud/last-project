const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios').default;
const { getAttemptPercentage, getLatestFinishedAttempt } = require('@smartcareer/shared');
const { formatJobSalary } = require('@smartcareer/shared');

test('Salary labels preserve currency, missing endpoints and a genuine zero', () => {
  assert.equal(formatJobSalary({}),null);
  assert.equal(formatJobSalary({salaryMin:0,salaryMax:0}), '฿0');
  assert.match(formatJobSalary({salaryMin:1000,salaryMax:2000,salaryCurrency:'USD'}),/US\$/);
  assert.doesNotMatch(formatJobSalary({salaryMin:1000,salaryCurrency:'USD'}),/฿/);
  assert.match(formatJobSalary({salaryMax:1000}),/^ไม่เกิน/);
});
const { candidateFeedback } = require('../apps/api/dist/assessments/candidate-feedback');
const { GithubService } = require('../apps/api/dist/github/github.service');
const { CompanyService } = require('../apps/api/dist/company/company.service');
const { CourseScreeningService } = require('../apps/api/dist/ingestion/course-screening.service');

test('Confirmed course cleanup never expands selected IDs, rechecks availability and preserves live courses', async () => {
  const deleted=[];let query;
  const service=new CourseScreeningService({course:{findMany:async args=>{
    query=args;return [{id:'selected-closed',title:'QA closed',provider:'UDEMY',url:'qa:closed'},{id:'selected-recovered',title:'QA recovered',provider:'UDEMY',url:'qa:live'}];
  },delete:async({where})=>{deleted.push(where.id);}},ingestionLog:{create:async()=>{}}});
  service.evaluateCourse=async course=>({isClosed:course.id==='selected-closed',reason:'QA 404',reasonCode:'HTTP_404_NOT_FOUND'});
  const result=await service.scanAndCleanCourses({provider:'UDEMY',limit:1,courseIds:['selected-closed','selected-recovered']});
  assert.deepEqual(query.where,{id:{in:['selected-closed','selected-recovered']},provider:'UDEMY'});
  assert.equal(query.take,2);assert.deepEqual(deleted,['selected-closed']);assert.equal(result.deletedCount,1);
});
const { AssessmentsService } = require('../apps/api/dist/assessments/assessments.service');
const { codingAttemptTotals } = require('../apps/api/dist/assessments/coding-attempt-totals');
const { JobScreeningService } = require('../apps/api/dist/ingestion/job-screening.service');
const { SchedulerService } = require('../apps/api/dist/scheduler/scheduler.service');
const {validateLocalJobBatch}=require('../apps/api/dist/ingestion/local-job-batch');

test('Coding failures use the real HTTP status when API messages omit Judge0 or status numbers', async () => {
  const fs=require('node:fs');const ts=require('typescript');
  const load=file=>{const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;new Function('exports',code)(exports);return exports;};
  const {apiRequest}=load('apps/web/lib/api.ts');
  const {getCodingFailureKind}=load('apps/web/lib/assessment-errors.ts');
  const original=global.fetch;
  try {
    for(const [status,message,expected] of [
      [503,'Code evaluation server is currently unavailable. Please retry in a few moments.','unavailable'],
      [429,'Too many requests','rate-limit'],
      [422,'Invalid source code','other'],
      [401,'Judge0 is not available to this account','other'],
    ]) {
      global.fetch=async()=>new Response(JSON.stringify({message}),{status,headers:{'content-type':'application/json'}});
      await assert.rejects(apiRequest('/assessments/qa/run-code',{method:'POST'}),error=>{assert.equal(error.status,status);assert.equal(error.message,message);assert.equal(getCodingFailureKind(error),expected);return true;});
    }
    assert.equal(getCodingFailureKind(new Error('JUDGE_UNAVAILABLE')),'unavailable');
    assert.equal(getCodingFailureKind(null),'other');
  } finally {global.fetch=original;}
});

const localBatch=()=>({version:1,source:'JOBSDB',collectedAt:new Date().toISOString(),jobs:[{id:'jobsdb-12345678',title:'QA Engineer',company:'QA Company',logoUrl:null,description:'QA listing',location:'Bangkok',isRemote:false,employmentType:'CONTRACT',salaryMin:0,salaryMax:null,url:'https://th.jobsdb.com/job/12345678'}]});

test('Backfilling external job skills excludes known invented requirements and preserves employer-authored internal text',async()=>{
  const legacy='Proficiency with modern web tech stack, Git, team collaboration, and problem-solving.';
  const inputs=[];const jobs=['REMOTIVE','INTERNAL'].map(source=>({id:source,source,title:'Support Engineer',description:'Support our users.',requirements:legacy}));
  const service=new(require('../apps/api/dist/ingestion/ingestion.service').IngestionService)({job:{findMany:async({select})=>{assert.equal(select.source,true);return jobs;}}},{extractSkills:async(...args)=>{inputs.push(args);return[];}},{});
  await service.backfillAllJobSkills();
  assert.equal(inputs[0][2],undefined);assert.equal(inputs[1][2],legacy);
  await service.assignSkillsToJob('fresh','Developer','Use Rust.','Use Git.','JOBSDB');
  assert.equal(inputs[2][2],'Use Git.');
});

test('Skill extraction fallback does not invent a typical stack from a job title', async()=>{
  const {GeminiExtractorService}=require('../apps/api/dist/ingestion/gemini-extractor.service');
  const service=new GeminiExtractorService();
  service.callGeminiFlash=async()=>[];
  for(const title of ['QA Engineer','Frontend Developer','Full Stack Developer','Performance Media Optimization']){
    assert.deepEqual(await service.extractSkills(title,'Build modern products with our team.'),[]);
  }
  const skills=await service.extractSkills('Full Stack Developer','Use React, Go and PostgreSQL.');
  assert.deepEqual(skills.map(s=>s.name).sort(),['Go','PostgreSQL','React']);
  assert.deepEqual(await service.extractSkills('QA Engineer','','Use Selenium and SQL.').then(s=>s.map(x=>x.name).sort()),['SQL','Selenium']);
  service.callGeminiFlash=async()=>{throw new Error('unavailable');};
  assert.deepEqual(await service.extractSkills('Backend Developer','No named technology.'),[]);
  const oldKey=process.env.GEMINI_API_KEY;
  try {
    process.env.GEMINI_API_KEY='isolated-test-key';
    service.callGeminiFlash=async()=>[
      {name:'Node.js',category:'BACKEND',isRequired:true,minimumScore:70},
      {name:'PostgreSQL',category:'DATABASE',isRequired:true,minimumScore:65},
      {name:'React',category:'FRONTEND',isRequired:true,minimumScore:70},
      {name:'Rust',category:'BACKEND',isRequired:true,minimumScore:70},
    ];
    assert.deepEqual(await service.extractSkills('Full Stack Developer','Build products.'),[]);
    assert.deepEqual((await service.extractSkills('Developer','Use React and Rust.')).map(s=>s.name),['React','Rust']);
  } finally { if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey; }
});

test('Local imports reject arbitrary destinations, forged IDs, stale files and injected ownership fields before saving',()=>{
  const valid=localBatch();assert.equal(validateLocalJobBatch(valid).jobs[0].salaryMin,0);
  for(const patch of [{url:'http://th.jobsdb.com/job/12345678'},{url:'https://th.jobsdb.com.evil.test/job/12345678'},{url:'https://user:password@th.jobsdb.com/job/12345678'},{id:'other-id'},{companyId:'victim'},{salaryMin:-1},{salaryMin:20,salaryMax:10},{logoUrl:'http://localhost/secret'}]){
    assert.throws(()=>validateLocalJobBatch({...valid,jobs:[{...valid.jobs[0],...patch}]}));
  }
  assert.throws(()=>validateLocalJobBatch({...valid,jobs:[valid.jobs[0],valid.jobs[0]]}));
  assert.throws(()=>validateLocalJobBatch({...valid,collectedAt:new Date(Date.now()-8*86400000).toISOString()}));
  assert.throws(()=>validateLocalJobBatch({...valid,source:'INTERNAL'}));
  assert.throws(()=>validateLocalJobBatch({...valid,secret:'must not be uploaded'}));
});

test('Local import preview is read-only, saves actual jobs through the shared path and skips repeated jobs',async()=>{
  const jobs=[];let logs=0;let fetched=0;
  const service=new (require('../apps/api/dist/ingestion/ingestion.service').IngestionService)({job:{findFirst:async()=>jobs[0]||null,create:async({data})=>{const j={id:'qa',...data};jobs.push(j);return j;}},ingestionLog:{create:async({data})=>({id:String(++logs),...data})}}, {}, {});
  service.fetchJSearchJobs=async()=>{fetched++;};service.assignSkillsToJob=async()=>{};
  const batch=localBatch();assert.equal((await service.previewLocalJobs(batch)).newCount,1);assert.equal(jobs.length,0);assert.equal(logs,0);
  const first=await service.performJobsSync('JOBSDB',10,undefined,batch.jobs);
  const second=await service.performJobsSync('JOBSDB',10,undefined,batch.jobs);
  assert.equal(first.createdCount,1);assert.equal(second.createdCount,0);assert.equal(second.duplicateCount,1);
  assert.equal(jobs[0].sourceUrl,batch.jobs[0].url);assert.equal(jobs[0].source,'JOBSDB');assert.equal(fetched,0);
});

function runHarness() {
  const rows = [];
  const matches = (row, where) => Object.entries(where).every(([key,value]) =>
    value && typeof value === 'object' && value.lt ? row[key] < value.lt : row[key] === value);
  const prisma = { ingestionRun: {
    findUnique: async ({where}) => rows.find(row => matches(row,where)) || null,
    findMany: async ({where}) => rows.filter(row => matches(row,where)),
    create: async ({data}) => {
      if (rows.some(row => row.requestKey === data.requestKey || (data.activeKey && row.activeKey === data.activeKey))) throw {code:'P2002'};
      const row = {id:require('crypto').randomUUID(),state:'RUNNING',startedAt:new Date(),heartbeatAt:new Date(),...data};
      rows.push(row);return {...row};
    },
    updateMany: async ({where,data}) => {const found=rows.filter(row=>matches(row,where));found.forEach(row=>Object.assign(row,data));return {count:found.length};},
  }};
  const service=new (require('../apps/api/dist/ingestion/ingestion.service').IngestionService)(prisma,{},
    {getQuotas:()=>({JOBTHAI:{category:'JOB',min:10,max:50,quota:25},JOBSDB:{category:'JOB',min:10,max:60,quota:30}})});
  return {rows,service};
}

test('Local file retries share a durable run, reject different content and never silently join another import',async()=>{
  const {service}=runHarness();let finish;const gate=new Promise(resolve=>{finish=resolve;});let calls=0;
  service.performJobsSync=async(_s,_q,_check,rows)=>{assert.equal(rows[0].id,'jobsdb-12345678');calls++;await gate;return{status:'SUCCESS',createdCount:1};};
  const key=require('crypto').randomUUID();const batch=localBatch();
  try {
    const first=await service.startLocalJobs(batch,key);
    assert.equal((await service.startLocalJobs(batch,key)).id,first.id);
    await assert.rejects(service.startLocalJobs(batch,require('crypto').randomUUID()),/รอบนำเข้า/);
    await assert.rejects(service.startLocalJobs({...batch,jobs:[{...batch.jobs[0],title:'Changed'}]},key),/คำขออื่น/);
    finish();await new Promise(resolve=>setImmediate(resolve));
    assert.equal((await service.startLocalJobs(batch,key)).state,'COMPLETED');assert.equal(calls,1);
  } finally {finish();await new Promise(resolve=>setImmediate(resolve));}
});

test('Long imports return a durable run immediately and concurrent/retried starts share one worker', async () => {
  const {service,rows}=runHarness();let finish;let calls=0;
  const gate=new Promise(resolve=>{finish=resolve;});
  service.performJobsSync=async()=>{calls++;await gate;return {id:'audit-1',status:'SUCCESS',createdCount:10,errorCount:0};};
  const key=require('crypto').randomUUID();const competingKey=require('crypto').randomUUID();
  try {
    const [a,b]=await Promise.all([service.startJobsRun('JOBTHAI',10,key),service.startJobsRun('JOBTHAI',10,competingKey)]);
    assert.equal(a.id,b.id);assert.equal(a.state,'RUNNING');assert.equal(calls,1);
    assert.equal((await service.startJobsRun('JOBTHAI',10,key)).id,a.id);
    assert.equal((await service.getJobsRun(a.id)).state,'RUNNING');
    assert.equal((await service.listJobsRuns())[0].id,a.id);
    finish();await new Promise(resolve=>setImmediate(resolve));
    const completed=await service.getJobsRun(a.id);
    assert.equal(completed.state,'COMPLETED');assert.equal(completed.result.createdCount,10);
    assert.equal(rows[0].activeKey,null);
    assert.equal((await service.startJobsRun('JOBTHAI',10,key)).id,a.id);assert.equal(calls,1);
    assert.equal((await service.startJobsRun('JOBTHAI',10,competingKey)).id,a.id);assert.equal(calls,1);
    await assert.rejects(service.startJobsRun('JOBTHAI',11,key),/คำขออื่น/);
  } finally {finish();await new Promise(resolve=>setImmediate(resolve));}
});

test('Stale runs are interrupted instead of reported successful, and stale workers cannot publish results', async () => {
  const {service,rows}=runHarness();let finish;const gate=new Promise(resolve=>{finish=resolve;});
  service.performJobsSync=async (_source,_quota,check)=>{await gate;await check();assert.fail('A fenced worker must stop');};
  const run=await service.startJobsRun('JOBTHAI',10,require('crypto').randomUUID());
  try {
    rows[0].heartbeatAt=new Date(Date.now()-180000);
    const interrupted=await service.getJobsRun(run.id);
    assert.equal(interrupted.state,'INTERRUPTED');assert.equal(interrupted.activeKey,null);
    finish();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(rows[0].state,'INTERRUPTED');assert.equal(rows[0].result,undefined);
  } finally {finish();await new Promise(resolve=>setImmediate(resolve));}
});

test('Import run validation rejects unsupported sources, malformed keys and out-of-range quotas before work', async () => {
  const {service,rows}=runHarness();service.performJobsSync=async()=>assert.fail('Invalid requests cannot run');
  await assert.rejects(service.startJobsRun('INTERNAL',10,require('crypto').randomUUID()),/ไม่ถูกต้อง/);
  await assert.rejects(service.startJobsRun('JOBTHAI',10,'bad-key'),/ไม่ถูกต้อง/);
  await assert.rejects(service.startJobsRun('JOBTHAI',9,require('crypto').randomUUID()),/ระหว่าง/);
  assert.equal(rows.length,0);
});

test('Finished results remain readable for closed applications without granting retakes or exposing exam content', async () => {
  for (const status of ['REJECTED', 'CANCELLED']) {
    const candidate = { id: 'owner-profile' };
    const assessment = {id:'company-exam',companyId:'qa-company',isActive:true,questions:[{id:'q',solutionCode:'secret',testCases:[{isHidden:true,input:'secret',expectedOutput:'secret'}]}]};
    const service = new AssessmentsService({
      candidateProfile:{findUnique:async ({where}) => {assert.equal(where.userId,'owner-user');return candidate;}},
      assessment:{findUnique:async()=>assessment},
      jobApplication:{findFirst:async ({where})=>{assert(where.status.notIn.includes(status));return null;}},
      assessmentAttempt:{findFirst:async ({where})=>{assert.equal(where.candidateId,candidate.id);assert.equal(where.assessmentId,assessment.id);assert.deepEqual(where.status.in,['COMPLETED','EXPIRED']);return {id:'finished-own'};},create:async()=>assert.fail('Closed applications cannot create attempts')},
    },{},{});
    const metadata=await service.findOne(assessment.id,'owner-user');
    assert.equal(metadata.canStartAttempt,false);
    assert.deepEqual(metadata.questions,[]);
    await assert.rejects(service.startAttempt(assessment.id,'owner-user'),/เฉพาะผู้สมัคร/);
  }
});

test('Another candidate or an unfinished draft cannot grant access to a closed company exam', async () => {
  for (const attempt of [{candidateId:'someone-else',status:'COMPLETED'},{candidateId:'viewer',status:'IN_PROGRESS'},{candidateId:'viewer',status:'SYSTEM_ERROR'}]) {
    const service=new AssessmentsService({
      candidateProfile:{findUnique:async()=>({id:'viewer'})},
      assessment:{findUnique:async()=>({id:'exam',companyId:'company',isActive:true,questions:[]})},
      jobApplication:{findFirst:async()=>null},
      assessmentAttempt:{findFirst:async({where})=>where.candidateId===attempt.candidateId&&where.status.in.includes(attempt.status)?attempt:null},
    },{},{});
    await assert.rejects(service.findOne('exam','viewer-user'),/เฉพาะผู้สมัคร/);
  }
});

test('An inactive exam permits only an owned finished result while active assignments keep start permission', async () => {
  let active=false;
  const service=new AssessmentsService({
    candidateProfile:{findUnique:async()=>({id:'owner'})},
    assessment:{findUnique:async()=>({id:'exam',companyId:'company',isActive:active,questions:[]})},
    jobApplication:{findFirst:async()=>({id:'assigned'})},
    assessmentAttempt:{findFirst:async()=>({id:'completed'})},
  },{},{});
  assert.equal((await service.findOne('exam','user')).canStartAttempt,false);
  await assert.rejects(service.startAttempt('exam','user'),/not available/);
  active=true;
  assert.equal((await service.findOne('exam','user')).canStartAttempt,true);
});

test('Job cleanup keeps closed internal jobs and expired external jobs even for legacy DELETE requests', async () => {
  const jobs=[{id:'hired',source:'INTERNAL',isActive:false},{id:'external',source:'JSEARCH',isActive:true,expiresAt:new Date(0)}];
  let writes;
  const service=new JobScreeningService({job:{findMany:async()=>jobs,delete:async()=>assert.fail('Cleanup must never cascade-delete applications'),updateMany:async args=>{writes=args;return{count:1};}},ingestionLog:{create:async()=>{}}});
  const result=await service.scanAndCleanJobs({deleteMode:'DELETE'});
  assert.equal(result.deletedCount,0);
  assert.equal(result.deactivatedCount,1);
  assert.deepEqual(writes.where,{id:{in:['hired','external']},isActive:true});
  assert(result.items.every(item=>item.actionTaken==='DEACTIVATED'));
});

test('Scheduled job cleanup deactivates instead of deleting recruitment records', async () => {
  let options;
  const service=new SchedulerService({}, {scanAndCleanJobs:async args=>{options=args;return{scannedCount:1,deactivatedCount:1,deletedCount:0};}}, {}, {});
  await service.handleDailyClosedJobCleanupCron();
  assert.equal(options.deleteMode,'DEACTIVATE');
});

test('Resuming an attempt exposes submitted question IDs without answers or private grades', () => {
  const result = candidateFeedback({status:'IN_PROGRESS',reviewStatus:'PENDING_HUMAN_REVIEW',score:25,
    answers:[{questionId:'first',sourceCode:'private answer',executionResult:{hiddenTests:['secret']}},{questionId:'first'}],
    snapshot:{markingKey:'secret'}, assessment:{companyId:'qa',feedbackVisibility:'PRIVATE_TO_COMPANY'}});
  assert.deepEqual(result.submittedQuestionIds,['first']);
  assert.equal(result.answers,undefined);
  assert.equal(result.snapshot,undefined);
  assert.equal(result.score,null);
});

test('Submitting the last coding question returns whole-exam points, not just that question', async () => {
  const answers=[{questionId:'first',pointsEarned:25,executionResult:{}}];
  const attempt={id:'qa',status:'IN_PROGRESS',startedAt:new Date(),reviewStatus:'NOT_REQUIRED',assessment:{companyId:null,skillId:null,timeLimitMinutes:5,passingScore:70,questions:[{id:'first',points:25},{id:'second',points:25,evaluationMethod:'AUTOMATED_TEST_CASES',testCases:[{input:'2,3',expectedOutput:'5'}]}]}};
  let stored;
  const tx={assessmentAnswer:{findFirst:async()=>null,create:async({data})=>{answers.push(data);},findMany:async()=>answers},assessmentAttempt:{update:async({data})=>{stored=data;return data;}}};
  const service=new AssessmentsService({...tx,$transaction:async fn=>fn(tx)}, {execute:async()=>({passedTestCases:0,totalTestCases:1})},{});
  service.validateAttemptOwnership=async()=>attempt;
  const result=await service.submitCodingSolution('qa','second','qa-user','function solution(a,b){return 0;}');
  assert.equal(result.isFinished,true);
  assert.equal(result.pointsEarned,0);
  assert.equal(result.totalPointsEarned,25);
  assert.equal(result.maxScore,50);
  assert.equal(result.percentage,50);
  assert.equal(stored.score,25);
});

test('A later test-case answer cannot turn a pending rubric evaluation into a zero-percent failure', () => {
  const assessment={companyId:null,passingScore:70,questions:[{id:'ai',points:25,evaluationMethod:'OPEN_ENDED'},{id:'tc',points:25,evaluationMethod:'AUTOMATED_TEST_CASES'}]};
  const totals=codingAttemptTotals(assessment,[{questionId:'ai',pointsEarned:0,executionResult:{evaluationPending:true}},{questionId:'tc',pointsEarned:25}],false,'EVALUATION_PENDING','AUTOMATED_TEST_CASES');
  assert.equal(totals.reviewStatus,'EVALUATION_PENDING');
  for(const field of ['score','percentage','passed','aiScore','finalScore']) assert.equal(totals[field],null);
  const disclosed=candidateFeedback({...totals,totalPointsEarned:25},{companyId:'qa-company',feedbackVisibility:'PRIVATE_TO_COMPANY'});
  assert.equal(disclosed.totalPointsEarned,null);
});

test('Resolved mixed coding results use weighted whole-exam points and retain company human review', () => {
  const assessment={companyId:'qa-company',passingScore:70,questions:[{id:'ai',points:25,evaluationMethod:'OPEN_ENDED'},{id:'tc',points:25,evaluationMethod:'AUTOMATED_TEST_CASES'}]};
  const totals=codingAttemptTotals(assessment,[{questionId:'ai',pointsEarned:12.5,executionResult:{evaluationPending:false}},{questionId:'tc',pointsEarned:25}],false,'PENDING_HUMAN_REVIEW','AUTOMATED_TEST_CASES');
  assert.equal(totals.score,37.5);
  assert.equal(totals.maxScore,50);
  assert.equal(totals.percentage,75);
  assert.equal(totals.reviewStatus,'PENDING_HUMAN_REVIEW');
  assert.equal(totals.finalScore,null);
});
const { honestJobContent } = require('../apps/api/dist/jobs/job-content');
const { IngestionService } = require('../apps/api/dist/ingestion/ingestion.service');
const { JobsService } = require('../apps/api/dist/jobs/jobs.service');
const { legacySampleJobIds } = require('../apps/api/dist/jobs/legacy-sample-jobs');

test('HTML job fetch works through Node HTTP without an installed curl and sanitizes source failures', async () => {
  const original=axios.get;
  const service=new IngestionService({}, {}, {});
  try {
    axios.get=async(url,options)=>{assert.equal(url,'https://example.invalid/jobs');assert.equal(options.responseType,'text');assert.equal(options.timeout,12000);return {data:'<html>Live listings</html>'};};
    assert.equal(await service.fetchNativeHtml('https://example.invalid/jobs'),'<html>Live listings</html>');
    axios.get=async()=>{throw {response:{status:403},message:'private provider response and credentials'};};
    await assert.rejects(service.fetchNativeHtml('https://example.invalid/jobs'),error=>error.message.includes('SOURCE_HTTP_403')&&!error.message.includes('private'));
  } finally {axios.get=original;}
});

test('Blognone parses separate job, employer and salary elements without styles or salary becoming the employer', async () => {
  const service=new IngestionService({}, {}, {});
  service.fetchNativeHtml=async()=>`<a href="/company/qa/job/engineer-1"><style>.css-x{color:red}</style><h3>QA Engineer</h3><h4>Full time</h4><span itemtype="http://schema.org/MonetaryAmount">฿20,000-฿40,000</span><span>QA Employer</span><span class="text-muted">Bangkok</span></a>`;
  const rows=await service.scrapeBlognoneJobs(5);
  assert.equal(rows.length,1);assert.equal(rows[0].title,'QA Engineer');assert.equal(rows[0].company,'QA Employer');assert.equal(rows[0].salaryMin,20000);assert.equal(rows[0].salaryMax,40000);
  assert.equal(rows[0].url,'https://jobs.blognone.com/company/qa/job/engineer-1');
});

test('Rendered job pages reject foreign destinations, isolate credentials and close the browser after failures', async () => {
  const {fetchRenderedJobHtml,allowedJobAsset}=require('../apps/api/dist/ingestion/rendered-job-html');
  let launches=0,closed=0,handler;
  const previous=process.env.JWT_SECRET;
  process.env.JWT_SECRET='isolated-browser-secret';
  const launch=async(options)=>{
    launches++;assert.equal(options.env.JWT_SECRET,undefined);
    return {newPage:async()=>({setDefaultTimeout:()=>{},setRequestInterception:async()=>{},on:(_event,callback)=>{handler=callback;},
      goto:async()=>({status:()=>403}),url:()=> 'https://jobs.blognone.com/search',waitForSelector:async()=>{throw new Error('not ready');}}),close:async()=>{closed++;}};
  };
  try {
    for(const url of ['http://jobs.blognone.com/search','https://jobs.blognone.com.evil.test/search','https://127.0.0.1/','file:///tmp/private','https://user:secret@th.jobsdb.com/jobs']) {
      await assert.rejects(fetchRenderedJobHtml(url,launch),/SOURCE_BROWSER_URL_DENIED/);
    }
    assert.equal(launches,0);
    await assert.rejects(fetchRenderedJobHtml('https://jobs.blognone.com/search',launch),/SOURCE_HTTP_403/);
    assert.equal(closed,1);
    let aborted=0,continued=0;
    await handler({isNavigationRequest:()=>true,url:()=> 'http://169.254.169.254/latest/meta-data/',abort:async()=>{aborted++;},continue:async()=>{continued++;}});
    assert.equal(aborted,1);assert.equal(continued,0);
    assert.equal(allowedJobAsset('https://jobs-static-prod.blognone.com/app.js'),true);
    assert.equal(allowedJobAsset('https://jobs-api.blognone.com/search'),true);
    assert.equal(allowedJobAsset('https://unapproved.example/app.js'),false);
    await assert.rejects(fetchRenderedJobHtml('https://th.jobsdb.com/jobs',async()=>{throw new Error('secret runtime details');}),/SOURCE_BROWSER_UNAVAILABLE/);
  } finally {if(previous===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=previous;}
});

test('Rendered jobs wait for real cards after an intermediate 403, reject rate limits and recheck the final destination', async () => {
  const {fetchRenderedJobHtml}=require('../apps/api/dist/ingestion/rendered-job-html');
  let status=403,waits=0,closed=0,finalUrl='https://jobs.blognone.com/search';
  const launch=async()=>({newPage:async()=>({setDefaultTimeout:()=>{},setRequestInterception:async()=>{},on:()=>{},
    goto:async()=>({status:()=>status}),url:()=>finalUrl,
    waitForSelector:async selector=>{waits++;assert.equal(selector,'a[href*="/job/"] h3');},
    content:async()=>'<a href="/company/qa/job/1"><h3>QA Developer</h3></a>'}),close:async()=>{closed++;}});
  assert.match(await fetchRenderedJobHtml(finalUrl,launch),/QA Developer/);
  assert.equal(waits,1);
  status=429;
  await assert.rejects(fetchRenderedJobHtml(finalUrl,launch),/SOURCE_HTTP_429/);
  assert.equal(waits,1);
  status=200;finalUrl='https://unapproved.example/search';
  await assert.rejects(fetchRenderedJobHtml('https://jobs.blognone.com/search',launch),/SOURCE_BROWSER_URL_DENIED/);
  assert.equal(closed,3);
});

test('Blognone ordinary headful Chrome has its own temporary display and releases it on success or browser failure', async () => {
  const {fetchRenderedJobHtml}=require('../apps/api/dist/ingestion/rendered-job-html');
  const previous=process.env.JOB_SCRAPER_BROWSER_MODE;process.env.JOB_SCRAPER_BROWSER_MODE='headful';
  let displays=0,closed=0,browsersClosed=0,fail=false;
  const display=async env=>{displays++;assert.equal(env.JWT_SECRET,undefined);assert.equal(env.DISPLAY,undefined);return {display:':83',close:async()=>{closed++;}};};
  const launch=async options=>{assert.equal(options.headless,false);assert.equal(options.env.DISPLAY,':83');return {newPage:async()=>({setDefaultTimeout:()=>{},setRequestInterception:async()=>{},on:()=>{},goto:async()=>({status:()=>403}),url:()=> 'https://jobs.blognone.com/search',waitForSelector:async()=>{if(fail)throw new Error('not ready');},content:async()=>'<a href="/company/qa/job/1"><h3>Real QA job</h3></a>'}),close:async()=>{browsersClosed++;}};};
  try{
    assert.match(await fetchRenderedJobHtml('https://jobs.blognone.com/search',launch,display),/Real QA job/);
    fail=true;await assert.rejects(fetchRenderedJobHtml('https://jobs.blognone.com/search',launch,display),/SOURCE_HTTP_403/);
    assert.equal(displays,2);assert.equal(closed,2);assert.equal(browsersClosed,2);
    await assert.rejects(fetchRenderedJobHtml('https://jobs.blognone.com/search',async()=>{throw new Error('failed launch');},display),/SOURCE_BROWSER_UNAVAILABLE/);assert.equal(closed,3);
    const jobDbLaunch=async options=>{assert.equal(options.headless,true);assert.equal(options.env.DISPLAY,undefined);throw new Error('launch test');};
    await assert.rejects(fetchRenderedJobHtml('https://th.jobsdb.com/jobs',jobDbLaunch,display),/SOURCE_BROWSER_UNAVAILABLE/);assert.equal(displays,3);
  }finally{if(previous===undefined)delete process.env.JOB_SCRAPER_BROWSER_MODE;else process.env.JOB_SCRAPER_BROWSER_MODE=previous;}
});

test('Virtual job displays do not listen on TCP and clean up failed startup without exposing system errors', async () => {
  const {EventEmitter}=require('node:events');const {openJobVirtualDisplay}=require('../apps/api/dist/ingestion/job-virtual-display');let output='83\n',exitEarly=false,killed=0;
  const start=(command,args,options)=>{assert.equal(command,'Xvfb');assert.deepEqual(args.slice(-2),['-nolisten','tcp']);assert.equal(options.env.JWT_SECRET,undefined);assert.equal(options.windowsHide,true);assert.deepEqual(options.stdio,['ignore','ignore','ignore','pipe']);
    const child=new EventEmitter();const pipe=new EventEmitter();child.stdio=[null,null,null,pipe];child.pid=99;child.exitCode=null;child.signalCode=null;child.kill=signal=>{killed++;child.signalCode=signal;child.emit('exit');return true;};
    queueMicrotask(()=>exitEarly?child.emit('error',new Error('private system paths')):pipe.emit('data',Buffer.from(output)));return child;
  };
  const display=await openJobVirtualDisplay({PATH:'isolated-test'},start);assert.equal(display.display,':83');await display.close();await display.close();assert.equal(killed,1);
  for(const invalid of ['\n','999999\n','private path','x'.repeat(17)]){output=invalid;await assert.rejects(openJobVirtualDisplay({},start),error=>/SOURCE_DISPLAY_UNAVAILABLE/.test(error.message)&&!error.message.includes('private'))}
  exitEarly=true;await assert.rejects(openJobVirtualDisplay({},start),/SOURCE_DISPLAY_UNAVAILABLE/);assert.equal(killed,6);
});

test('JobsDB parses visible cards and deduplicates legacy data while preserving actual job type and arrangement', async () => {
  const service=new IngestionService({}, {}, {});
  service.fetchNativeHtml=async()=>`<article data-testid="job-card"><a data-automation="jobTitle" href="/job/12345?ref=search">QA Developer</a><a data-automation="jobCompany">QA Company</a><a data-automation="jobLocation">Bangkok</a><span data-automation="jobShortDescription">Build QA tools</span><span data-testid="work-arrangement">Hybrid</span><p>This is a Contract/Temp job</p></article><script>window.SEEK_REDUX_DATA = {"results":{"results":{"jobs":[{"id":12345,"title":"QA Developer"}]}}};</script>`;
  const rows=await service.scrapeJobsDBJobs('QA',5);
  assert.equal(rows.length,1);assert.equal(rows[0].company,'QA Company');assert.equal(rows[0].isRemote,false);assert.equal(rows[0].employmentType,'CONTRACT');assert.equal(rows[0].url,'https://th.jobsdb.com/job/12345');
});

test('Blognone preserves contract work and skips links without actual job titles', async () => {
  const service=new IngestionService({}, {}, {}, {});
  service.fetchJobSourceHtml=async()=>'<a href="/company/qa/job/contract"><h3>QA Developer</h3><h4>Middle-Level, Contract</h4><span>QA Company</span></a><a href="/company/qa/job/missing">navigation only</a>';
  const jobs=await service.scrapeBlognoneJobs(5);
  assert.equal(jobs.length,1);
  assert.equal(jobs[0].employmentType,'CONTRACT');
  assert.equal(jobs[0].company,'QA Company');
});

test('A denied Blognone listing can read real public homepage cards once; other failures never trigger this alternative', async () => {
  const transport=require('../apps/api/dist/ingestion/public-job-http2');
  const publicApi=require('../apps/api/dist/ingestion/blognone-public-jobs');
  const originalApi=publicApi.fetchBlognonePublicJobs;
  const original=transport.fetchPublicJobHttp2;
  const service=new IngestionService({}, {}, {});let calls=0;
  try {
    publicApi.fetchBlognonePublicJobs=async()=>{throw new Error('SOURCE_HTTP_403: API denied');};
    service.fetchJobSourceHtml=async()=>{throw new Error('SOURCE_HTTP_403: denied');};
    transport.fetchPublicJobHttp2=async url=>{calls++;assert.equal(url,'https://jobs.blognone.com/');return '<a href="/company/qa/job/home"><h3>Homepage QA Developer</h3><h4>Contract</h4><span>Actual QA Company</span></a>';};
    const jobs=await service.scrapeBlognoneJobs(5);
    assert.equal(jobs.length,1);assert.equal(jobs[0].title,'Homepage QA Developer');assert.equal(jobs[0].company,'Actual QA Company');assert.equal(calls,1);
    service.fetchJobSourceHtml=async()=>{throw new Error('SOURCE_HTTP_429: rate limit');};
    await assert.rejects(service.scrapeBlognoneJobs(5),/SOURCE_HTTP_429/);assert.equal(calls,1);
    service.fetchJobSourceHtml=async()=>{throw new Error('SOURCE_HTTP_403: denied');};
    transport.fetchPublicJobHttp2=async()=>{throw new Error('SOURCE_HTTP_403: homepage also denied');};
    await assert.rejects(service.scrapeBlognoneJobs(5),/SOURCE_HTTP_403/);
  } finally {transport.fetchPublicJobHttp2=original;publicApi.fetchBlognonePublicJobs=originalApi;}
});

test('Blognone public job API preserves real fields, hides negotiable salaries and rejects incomplete or unsafe data', () => {
  const {parseBlognonePublicJobs}=require('../apps/api/dist/ingestion/blognone-public-jobs');
  const row={slug:'qa-1',title:'QA Developer',company:{slug:'actual-qa',name_en:'Actual QA'},type:'JOBTYPE_CONTRACT',province:'กรุงเทพมหานคร',district:'บางรัก',salary_min:25000,salary_max:45000,salary_display_format:'MIN_MAX'};
  const payload={data:{home_jobs:[row,{...row,slug:'qa-2',salary_display_format:'NEGOTIABLE'}]}};
  const jobs=parseBlognonePublicJobs(payload,5);
  assert.equal(jobs.length,2);assert.equal(jobs[0].employmentType,'CONTRACT');assert.equal(jobs[0].salaryMin,25000);assert.equal(jobs[0].location,'บางรัก, กรุงเทพมหานคร');
  assert.equal(jobs[0].url,'https://jobs.blognone.com/company/actual-qa/job/qa-1');assert.equal(jobs[1].salaryMin,null);assert.equal(jobs[1].salaryMax,null);
  assert.equal(parseBlognonePublicJobs(payload,1).length,1);assert.deepEqual(parseBlognonePublicJobs({data:{home_jobs:[]}},1),[]);
  for(const change of [{slug:'../private'},{company:{slug:'qa?token=x',name_en:'QA'}},{title:''},{type:'UNKNOWN'},{salary_min:50000},{salary_max:-1},{province:{private:true}}]){
    assert.throws(()=>parseBlognonePublicJobs({data:{home_jobs:[{...row,...change}]}},5),/SOURCE_DATA_INVALID/);
  }
  assert.throws(()=>parseBlognonePublicJobs({data:{home_jobs:[row,row]}},5),/SOURCE_DATA_INVALID/);
  assert.throws(()=>parseBlognonePublicJobs({errors:[{message:'private details'}],data:{home_jobs:[row]}},5),/SOURCE_DATA_INVALID/);
  assert.throws(()=>parseBlognonePublicJobs({data:{}},5),/SOURCE_DATA_INVALID/);
});

test('Blognone public API uses a bounded anonymous read and never exposes provider error details', async () => {
  const {fetchBlognonePublicJobs,blognonePublicEndpoint}=require('../apps/api/dist/ingestion/blognone-public-jobs');
  const axios=require('axios');const original=axios.post;
  try {
    axios.post=async(url,body,options)=>{assert.equal(url,blognonePublicEndpoint);assert.match(body.query,/query getHome/);assert.doesNotMatch(body.query,/mutation|my_candidate/);assert.equal(options.timeout,12000);assert.equal(options.maxRedirects,0);assert.equal(options.headers.Authorization,undefined);return {data:{data:{home_jobs:[]}}};};
    assert.deepEqual(await fetchBlognonePublicJobs(5),[]);
    axios.post=async()=>{throw {response:{status:429,data:'private details'}};};
    await assert.rejects(fetchBlognonePublicJobs(5),error=>/SOURCE_HTTP_429/.test(error.message)&&!error.message.includes('private'));
    axios.post=async()=>({data:{errors:[{message:'private details'}]}});
    await assert.rejects(fetchBlognonePublicJobs(5),/SOURCE_DATA_INVALID/);
  }finally{axios.post=original;}
});

test('A denied Blognone HTML listing uses the public API; rate limits and malformed data stop without another retry', async () => {
  const publicApi=require('../apps/api/dist/ingestion/blognone-public-jobs');const original=publicApi.fetchBlognonePublicJobs;
  const service=new IngestionService({}, {}, {});let calls=0;
  try{
    service.fetchJobSourceHtml=async()=>{throw new Error('SOURCE_HTTP_403: denied');};
    publicApi.fetchBlognonePublicJobs=async limit=>{calls++;assert.equal(limit,5);return [{id:'qa-1',title:'Actual QA job'}];};
    assert.equal((await service.scrapeBlognoneJobs(5))[0].id,'qa-1');
    service.fetchJobSourceHtml=async()=>{throw new Error('SOURCE_HTTP_429: rate limited');};
    await assert.rejects(service.scrapeBlognoneJobs(5),/SOURCE_HTTP_429/);assert.equal(calls,1);
    service.fetchJobSourceHtml=async()=>{throw new Error('SOURCE_HTTP_403: denied');};
    for(const message of ['SOURCE_HTTP_429: rate limited','SOURCE_DATA_INVALID: missing data']){
      publicApi.fetchBlognonePublicJobs=async()=>{throw new Error(message);};
      await assert.rejects(service.scrapeBlognoneJobs(5),error=>error.message.includes(message));
    }
  }finally{publicApi.fetchBlognonePublicJobs=original;}
});

test('Blognone API can use ordinary HTTP2 after a native 403, but never retries a rate limit', async () => {
  const {fetchBlognonePublicJobs}=require('../apps/api/dist/ingestion/blognone-public-jobs');
  const transport=require('../apps/api/dist/ingestion/blognone-public-http2');const axios=require('axios');
  const originals=[axios.post,transport.fetchBlognonePublicHttp2];let calls=0;
  try{
    axios.post=async()=>{throw {response:{status:403}};};
    transport.fetchBlognonePublicHttp2=async body=>{calls++;const json=JSON.parse(body);assert.equal(json.operationName,'getHome');assert.deepEqual(json.variables,{});assert.match(json.query,/home_jobs/);return {data:{home_jobs:[]}};};
    assert.deepEqual(await fetchBlognonePublicJobs(5),[]);assert.equal(calls,1);
    axios.post=async()=>{throw {response:{status:429}};};
    await assert.rejects(fetchBlognonePublicJobs(5),/SOURCE_HTTP_429/);assert.equal(calls,1);
    axios.post=async()=>{throw {response:{status:403}};};
    transport.fetchBlognonePublicHttp2=async()=>({errors:[{message:'private details'}]});
    await assert.rejects(fetchBlognonePublicJobs(5),/SOURCE_DATA_INVALID/);
  }finally{[axios.post,transport.fetchBlognonePublicHttp2]=originals;}
});

test('Blognone HTTP2 public reads use a fixed destination, reject redirects and oversized or incomplete JSON, and close sessions', async () => {
  const {EventEmitter}=require('node:events');const {fetchBlognonePublicHttp2}=require('../apps/api/dist/ingestion/blognone-public-http2');
  let status=200,content='{"data":{"home_jobs":[]}}',incomplete=false,closed=0;
  const body=JSON.stringify({operationName:'getHome',variables:{},query:'query getHome { home_jobs { slug } }'});
  const open=origin=>{assert.equal(origin,'https://jobs-api.blognone.com');const session=new EventEmitter();session.destroy=()=>{closed++;};session.request=headers=>{
    assert.equal(headers[':method'],'POST');assert.equal(headers[':path'],'/graphql');assert.equal(headers.authorization,undefined);assert.equal(headers['content-length'],Buffer.byteLength(body));
    const request=new EventEmitter();request.end=value=>{assert.equal(value,body);queueMicrotask(()=>{request.emit('response',{':status':status,location:'https://127.0.0.1/private'});request.emit('data',Buffer.from(content));request.emit(incomplete?'close':'end');});};return request;
  };return session;};
  assert.deepEqual(await fetchBlognonePublicHttp2(body,open),{data:{home_jobs:[]}});
  for(const code of [301,403,429]){status=code;await assert.rejects(fetchBlognonePublicHttp2(body,open),new RegExp(`SOURCE_HTTP_${code}`));}
  status=200;content='<html>denied</html>';await assert.rejects(fetchBlognonePublicHttp2(body,open),/SOURCE_DATA_INVALID/);
  content='x'.repeat(2*1024*1024+1);await assert.rejects(fetchBlognonePublicHttp2(body,open),/SOURCE_HTTP2_PAGE_TOO_LARGE/);
  content='{"data":{"home_jobs":[]}}';incomplete=true;await assert.rejects(fetchBlognonePublicHttp2(body,open),/SOURCE_HTTP2_CONNECTION_FAILED/);
  assert.equal(closed,7);
});

test('Job HTML uses the authorized browser for 403 or unrendered pages, but does not retry rate limits', async () => {
  const rendered=require('../apps/api/dist/ingestion/rendered-job-html');
  const transport=require('../apps/api/dist/ingestion/public-job-http2');
  const original=rendered.fetchRenderedJobHtml;
  const originalHttp2=transport.fetchPublicJobHttp2;
  const service=new IngestionService({}, {}, {});
  let calls=0;
  try {
    transport.fetchPublicJobHttp2=async()=>{throw new Error('SOURCE_HTTP_403: unavailable');};
    rendered.fetchRenderedJobHtml=async()=>{calls++;return '<a href="/company/qa/job/1"><h3>QA</h3></a>';};
    service.fetchNativeHtml=async()=>{throw new Error('SOURCE_HTTP_403: unavailable');};
    assert.match(await service.fetchJobSourceHtml('https://jobs.blognone.com/search'),/QA/);
    service.fetchNativeHtml=async()=> '<div id="root"></div>';
    await service.fetchJobSourceHtml('https://jobs.blognone.com/search');
    assert.equal(calls,2);
    service.fetchNativeHtml=async()=> '<a href="/company/qa/job/1"><h3>QA</h3></a>';
    await service.fetchJobSourceHtml('https://jobs.blognone.com/search');
    assert.equal(calls,2);
    service.fetchNativeHtml=async()=>{throw new Error('SOURCE_HTTP_429: rate limit');};
    await assert.rejects(service.fetchJobSourceHtml('https://jobs.blognone.com/search'),/SOURCE_HTTP_429/);
    assert.equal(calls,2);
  } finally {rendered.fetchRenderedJobHtml=original;transport.fetchPublicJobHttp2=originalHttp2;}
});

test('Anonymous HTTP/2 follows only bounded same-source redirects, closes sessions and sanitizes incomplete responses', async () => {
  const {EventEmitter}=require('events');
  const {fetchPublicJobHttp2}=require('../apps/api/dist/ingestion/public-job-http2');
  let responses=[],opened=0,closed=0;
  const open=origin=>{
    assert.equal(origin,'https://th.jobsdb.com');opened++;
    const session=new EventEmitter();let destroyed=false;
    session.destroy=()=>{destroyed=true;closed++;};
    session.request=headers=>{
      assert.equal(headers['user-agent'],'SmartCareer/1.0');
      assert.equal(headers.authorization,undefined);assert.equal(headers.cookie,undefined);
      const request=new EventEmitter();const response=responses.shift();
      request.end=()=>queueMicrotask(()=>{
        request.emit('response',{':status':response.status,location:response.location});
        if(destroyed)return;
        if(response.incomplete){request.emit('close');return;}
        request.emit('data',Buffer.from(response.body||''));request.emit('end');
      });
      return request;
    };return session;
  };
  responses=[{status:301,location:'/developer-jobs'},{status:200,body:'<article>Actual public job</article>'}];
  assert.match(await fetchPublicJobHttp2('https://th.jobsdb.com/jobs',open),/Actual public job/);
  assert.equal(opened,2);assert.equal(closed,2);
  for(const location of ['http://127.0.0.1/','https://jobs.blognone.com/search','https://user:secret@th.jobsdb.com/jobs']){
    responses=[{status:302,location}];
    await assert.rejects(fetchPublicJobHttp2('https://th.jobsdb.com/jobs',open),/SOURCE_HTTP2_URL_DENIED/);
  }
  responses=[{status:429}];
  await assert.rejects(fetchPublicJobHttp2('https://th.jobsdb.com/jobs',open),/SOURCE_HTTP_429/);
  responses=Array.from({length:4},()=>({status:302,location:'/jobs'}));
  await assert.rejects(fetchPublicJobHttp2('https://th.jobsdb.com/jobs',open),/SOURCE_HTTP2_REDIRECT_LIMIT/);
  responses=[{status:200,incomplete:true}];
  await assert.rejects(fetchPublicJobHttp2('https://th.jobsdb.com/jobs',open),/SOURCE_HTTP2_CONNECTION_FAILED/);
  responses=[{status:200,body:'x'.repeat(25*1024*1024+1)}];
  await assert.rejects(fetchPublicJobHttp2('https://th.jobsdb.com/jobs',open),/SOURCE_HTTP2_PAGE_TOO_LARGE/);
  assert.equal(opened,closed);
});

test('HTTP/2 real job cards satisfy a denied native listing without a browser; transport rate limits stop further work', async () => {
  const transport=require('../apps/api/dist/ingestion/public-job-http2');
  const rendered=require('../apps/api/dist/ingestion/rendered-job-html');
  const originals=[transport.fetchPublicJobHttp2,rendered.fetchRenderedJobHtml];
  const service=new IngestionService({}, {}, {});let calls=0;
  try {
    service.fetchNativeHtml=async()=>{throw new Error('SOURCE_HTTP_403: unavailable');};
    rendered.fetchRenderedJobHtml=async()=>{calls++;throw new Error('Unexpected browser');};
    transport.fetchPublicJobHttp2=async()=>'<a href="/company/qa/job/1"><h3>Actual QA job</h3></a>';
    assert.match(await service.fetchJobSourceHtml('https://jobs.blognone.com/search'),/Actual QA job/);
    assert.equal(calls,0);
    transport.fetchPublicJobHttp2=async()=>{throw new Error('SOURCE_HTTP_429: limit');};
    await assert.rejects(service.fetchJobSourceHtml('https://jobs.blognone.com/search'),/SOURCE_HTTP_429/);
    assert.equal(calls,0);
  } finally {[transport.fetchPublicJobHttp2,rendered.fetchRenderedJobHtml]=originals;}
});

test('JobThai uses the explicit employer element rather than duplicate mobile headings or a missing sibling', async () => {
  const service=new IngestionService({}, {}, {});
  service.fetchNativeHtml=async()=>`<a href="/th/company/job/123"><div><h2>QA Developer</h2></div><div><span id="job-list-company-name-9"><h2>QA Company</h2></span><h2>QA Company</h2></div></a>`;
  const rows=await service.scrapeJobThaiJobs(10);
  assert.equal(rows.length,1);assert.equal(rows[0].title,'QA Developer');assert.equal(rows[0].company,'QA Company');assert.equal(rows[0].url,'https://www.jobthai.com/th/company/job/123');
});

test('JSearch distinguishes missing key, access failure and quota without storing raw provider errors or fake jobs', async () => {
  const previous={rapid:process.env.RAPIDAPI_KEY,jsearch:process.env.JSEARCH_API_KEY};
  const original=axios.get;
  let writes=0;
  const service=new IngestionService({job:{create:async()=>{writes++;}},ingestionLog:{create:async({data})=>data}}, {}, {getQuotaForSource:()=>5});
  try {
    delete process.env.RAPIDAPI_KEY;delete process.env.JSEARCH_API_KEY;
    assert.match((await service.performJobsSync('JSEARCH',5)).errorMessage,/JSEARCH_MISSING_KEY/);
    process.env.JSEARCH_API_KEY='isolated-qa-key';
    for(const status of [401,403,429]) {
      axios.get=async()=>{throw {response:{status},message:'private provider body with isolated-qa-key'};};
      const result=await service.performJobsSync('JSEARCH',5);
      assert.equal(result.status,'FAILED');assert.equal(result.createdCount,0);assert.match(result.errorMessage,new RegExp(`JSEARCH_${status}`));assert(!result.errorMessage.includes('isolated-qa-key'));
    }
    for(const [code,expected] of [['ECONNABORTED','TIMEOUT'],['ETIMEDOUT','TIMEOUT'],['ENOTFOUND','DNS_FAILED'],['EAI_AGAIN','DNS_FAILED'],['ERR_INVALID_URL','INVALID_URL'],['ECONNRESET','CONNECTION_FAILED']]) {
      axios.get=async()=>{throw {code,message:'private URL and isolated-qa-key'};};
      const result=await service.performJobsSync('JSEARCH',5);
      assert.match(result.errorMessage,new RegExp(`JSEARCH_${expected}`));
      assert(!result.errorMessage.includes('isolated-qa-key'));
      assert(!result.errorMessage.includes('private URL'));
    }
    axios.get=async()=>({data:{data:[{job_id:'broken'}]}});
    assert.match((await service.performJobsSync('JSEARCH',5)).errorMessage,/JSEARCH_EMPTY_RESPONSE/);
    assert.equal(writes,0);
  } finally {
    axios.get=original;
    for(const [key,value] of [['RAPIDAPI_KEY',previous.rapid],['JSEARCH_API_KEY',previous.jsearch]]) {if(value===undefined) delete process.env[key];else process.env[key]=value;}
  }
});

test('JSearch prioritizes its trimmed dedicated key and falls back only when it is blank', async () => {
  const previous={rapid:process.env.RAPIDAPI_KEY,jsearch:process.env.JSEARCH_API_KEY};
  const original=axios.get;
  const service=new IngestionService({}, {}, {});
  const requested=[];
  try {
    axios.get=async(_url,options)=>{
      assert.equal(options.timeout,30000);
      requested.push(options.headers['X-RapidAPI-Key']);
      return {data:{data:[{job_id:'qa-key-selection',job_title:'QA Developer',employer_name:'QA Employer',job_apply_link:'https://example.com/qa-job'}]}};
    };
    process.env.RAPIDAPI_KEY='  legacy-qa-key  ';
    process.env.JSEARCH_API_KEY='  dedicated-qa-key  ';
    assert.equal((await service.fetchJSearchJobs('QA',1)).length,1);
    process.env.JSEARCH_API_KEY='   ';
    assert.equal((await service.fetchJSearchJobs('QA',1)).length,1);
    delete process.env.JSEARCH_API_KEY;
    assert.equal((await service.fetchJSearchJobs('QA',1)).length,1);
    assert.deepEqual(requested,['dedicated-qa-key','legacy-qa-key','legacy-qa-key']);
    process.env.RAPIDAPI_KEY='   ';
    await assert.rejects(service.fetchJSearchJobs('QA',1),/JSEARCH_MISSING_KEY/);
    assert.equal(requested.length,3);
  } finally {
    axios.get=original;
    for(const [key,value] of [['RAPIDAPI_KEY',previous.rapid],['JSEARCH_API_KEY',previous.jsearch]]) {if(value===undefined) delete process.env[key];else process.env[key]=value;}
  }
});

test('Unavailable HTML sources report the actual HTTP reason while preserving existing jobs', async () => {
  for(const source of ['BLOGNONE','JOBSDB','JOBTHAI']) {
    const service=new IngestionService({job:{create:async()=>assert.fail('Unavailable sources must not insert')},ingestionLog:{create:async({data})=>data}}, {}, {getQuotaForSource:()=>5});
    service.fetchNativeHtml=async()=>{throw new Error('SOURCE_HTTP_429: upstream rate limit');};
    const result=await service.performJobsSync(source,5);
    assert.equal(result.status,'FAILED');assert.match(result.errorMessage,/SOURCE_HTTP_429/);assert.equal(result.createdCount,0);
  }
});

test('Public vacancies quarantine exact legacy sample IDs without deleting any stored job', async () => {
  const sample={source:'BLOGNONE',externalId:legacySampleJobIds[0]};
  await assert.rejects(new JobsService({job:{findUnique:async()=>sample}},{}).findOne('qa'),/ข้อมูลตัวอย่างเดิม/);
  let query;
  const prisma={job:{findMany:async(args)=>{query=args.where;return [];},count:async()=>0}};
  await new JobsService(prisma,{}).findAll();
  assert.deepEqual(query.NOT.AND,[{source:{not:'INTERNAL'}},{externalId:{in:legacySampleJobIds}}]);
  assert.deepEqual(honestJobContent({source:'REMOTIVE',salaryMin:70000,salaryMax:140000}),{requirements:undefined,benefits:undefined,salaryMin:null,salaryMax:null});
});

test('Job ingestion preserves missing fields and zero salary rather than fabricating benefits or pay', async () => {
  const saved=[];
  const prisma={job:{findFirst:async()=>null,create:async({data})=>{saved.push(data);return {id:'qa-job'};}},ingestionLog:{create:async({data})=>data}};
  const service=new IngestionService(prisma,{}, {getQuotaForSource:()=>1});
  service.fetchRemotiveJobs=async()=>[{id:'qa',title:'QA source title',company:'QA source employer',url:'https://example.invalid/qa',salaryMin:0,salaryMax:0}];
  service.assignSkillsToJob=async()=>{};
  await service.performJobsSync('REMOTIVE',1);
  assert.equal(saved.length,1);
  assert.equal(saved[0].requirements,null);
  assert.equal(saved[0].benefits,null);
  assert.equal(saved[0].salaryMin,0);
  assert.equal(saved[0].salaryMax,0);
  assert.equal(saved[0].location,'ไม่ระบุสถานที่');
});

test('An empty live job provider records failure and keeps existing jobs without inserting sample data', async () => {
  let inserted=0;
  const service=new IngestionService({job:{create:async()=>{inserted++;}},ingestionLog:{create:async({data})=>data}}, {}, {getQuotaForSource:()=>1});
  service.fetchRemotiveJobs=async()=>[];
  const result=await service.performJobsSync('REMOTIVE',1);
  assert.equal(inserted,0);
  assert.equal(result.status,'FAILED');
  assert.match(result.errorMessage,/No live jobs returned/);
});

test('External job details suppress exact fabricated ingestion defaults without changing employer content', () => {
  const inserted = {source:'REMOTIVE',requirements:'Proficiency with modern web tech stack, Git, team collaboration, and problem-solving.',benefits:'Flexible working arrangements, competitive compensation, learning budget, and medical insurance.'};
  assert.deepEqual(honestJobContent(inserted), {requirements:null, benefits:null});
  assert.deepEqual(honestJobContent({...inserted,source:'INTERNAL'}), {requirements:inserted.requirements,benefits:inserted.benefits});
  assert.deepEqual(honestJobContent({source:'REMOTIVE',requirements:'Source requirements',benefits:'Source benefits'}), {requirements:'Source requirements',benefits:'Source benefits'});
});

test('Human review preserves raw points when the maximum is not 100', async () => {
  for (const humanScore of [0,40,75,100]) {
    let saved;
    const original = {id:'qa',score:50,maxScore:50,assessment:{companyId:'qa-company',passingScore:70}};
    const prisma = {
      assessmentAttempt:{findUnique:async()=>original,update:async({data})=>{saved={...original,...data};return saved;}},
      user:{findUnique:async()=>({role:'COMPANY',companyMembers:[{companyId:'qa-company'}]})},
    };
    await new AssessmentsService(prisma,{},{}).overrideAttemptScore('qa','qa-reviewer',humanScore,'QA score units');
    assert.equal(saved.score,50);
    assert.equal(saved.maxScore,50);
    assert.equal(getAttemptPercentage(saved),humanScore);
    assert.equal(saved.passed,humanScore>=70);
    assert.equal(saved.reviewStatus,'HUMAN_REVIEWED');
  }
});

test('Reopening finished exams preserves reviewed results; newer active rounds resume independently', () => {
  const completed = { assessmentId:'qa', status:'COMPLETED', startedAt:'2026-10-05T12:00:00Z', humanScore:40, percentage:0 };
  const other = { assessmentId:'other', status:'COMPLETED', startedAt:'2026-10-05T13:00:00Z' };
  assert.equal(getLatestFinishedAttempt([other, completed], 'qa'), completed);
  assert.equal(getAttemptPercentage(getLatestFinishedAttempt([completed], 'qa')), 40);
  const active = { assessmentId:'qa', status:'IN_PROGRESS', startedAt:'2026-10-05T12:01:00Z' };
  assert.equal(getLatestFinishedAttempt([completed, active], 'qa'), null);
  assert.equal(getLatestFinishedAttempt([completed], 'unknown'), null);
  assert.deepEqual([other, completed].map(x=>x.assessmentId), ['other','qa']);
});

test('Raw points normalize against their maximum; human zero overrides machine scores', () => {
  for (const [score, maxScore, expected] of [[50,50,100],[25,50,50],[50,200,25],[0,50,0]]) {
    assert.equal(getAttemptPercentage({ status:'COMPLETED', score, maxScore }), expected);
  }
  assert.equal(getAttemptPercentage({ humanScore:0, finalScore:90 }), 0);
  assert.equal(getAttemptPercentage({ score:50 }), null);
  assert.equal(getAttemptPercentage({ status:'IN_PROGRESS', percentage:100 }), null);
  assert.equal(getAttemptPercentage({ reviewStatus:'PENDING_HUMAN_REVIEW', percentage:100 }), null);
});

test('All three company disclosure modes enforce review state and never expose marking snapshots', () => {
  for (const visibility of ['IMMEDIATE','AFTER_REVIEW','PRIVATE_TO_COMPANY']) {
    for (const reviewStatus of ['PENDING_HUMAN_REVIEW','HUMAN_REVIEWED']) {
      const input = { score:50, percentage:100, humanScore:100, passed:true, reviewReason:'Internal audit only', reviewedById:'internal-reviewer', snapshot:{secret:true}, answers:[{isCorrect:true}], evaluationSnapshot:{secret:true}, reviewStatus, assessment:{companyId:'company', feedbackVisibility:visibility, questions:[{solutionCode:'secret'}]} };
      const output = candidateFeedback(input);
      const hidden = visibility === 'PRIVATE_TO_COMPANY' || (visibility === 'AFTER_REVIEW' && reviewStatus !== 'HUMAN_REVIEWED');
      assert.equal(output.feedbackHidden, hidden);
      assert.equal(output.percentage, hidden ? null : 100);
      assert.equal(output.snapshot, undefined);
      assert.equal(output.answers, undefined);
      assert.equal(output.assessment.questions, undefined);
      assert.equal(output.reviewReason, undefined);
      assert.equal(output.reviewedById, undefined);
      assert.equal(input.percentage, 100);
      if (hidden) assert.equal(output.evaluationSnapshot, null);
    }
  }
});

test('GitHub paginates beyond 100 repositories and preserves zero and absent metadata', async () => {
  const original = axios.get;
  const pages = [];
  const repo = i => ({name:`r${i}`,full_name:`qa/r${i}`,html_url:`https://github.com/qa/r${i}`,languages_url:`https://api.github.com/repos/qa/r${i}/languages`,size:0,stargazers_count:0,description:null,language:null});
  axios.get = async (url, options) => {
    if (url.endsWith('/repos')) { pages.push(options.params.page); return {data:options.params.page===1 ? Array.from({length:100},(_,i)=>repo(i)) : [repo(100)]}; }
    if (url.endsWith('/languages')) return {data:{}};
    throw {response:{status:404}};
  };
  try {
    const results = await new GithubService({}).fetchUserRepositories('qa');
    assert.equal(results.length,101);
    assert.deepEqual(pages,[1,2]);
    assert.equal(results[0].stars,0);
    assert.equal(results[0].language,'');
    assert.equal(results[0].description,'');
    assert.deepEqual(results[0].detectedSkills,[]);
  } finally { axios.get = original; }
});

test('Unavailable GitHub does not bind an account or replace existing evidence', async () => {
  const original = axios.get;
  let writes = 0;
  axios.get = async () => { throw {response:{status:503}}; };
  const prisma = {candidateProfile:{findUnique:async()=>({id:'qa',githubUsername:'qa'})},$transaction:async()=>{writes++;}};
  try {
    await assert.rejects(new GithubService(prisma).syncCandidateGithub('user'), /GitHub/);
    assert.equal(writes,0);
  } finally {axios.get = original;}
});

test('A repeated GitHub skill is written once, keeps quiz/code scores and batches all evidence', async () => {
  let skillWrites = 0;
  let evidence;
  let staleUpdate;
  const tx = {
    gitHubRepository:{deleteMany:async()=>{},upsert:async args=>({id:args.create.fullName})},
    gitHubEvidence:{deleteMany:async()=>{},createMany:async args=>{evidence=args.data;}},
    skill:{createMany:async()=>{},findMany:async()=>[{id:'js',name:'JavaScript'}]},
    candidateSkill:{
      findMany:async()=>[{id:'existing',skillId:'js',theoryScore:100,codingScore:50},{id:'stale',skillId:'old',theoryScore:50,codingScore:100}],
      upsert:async args=>{skillWrites++;assert.deepEqual(args.update,{practicalScore:65,verifiedScore:68,isVerified:true});return{id:'existing'};},
      update:async args=>{staleUpdate=args;},
    },
  };
  const profile={id:'candidate',githubUsername:'qa'};
  const service=new GithubService({candidateProfile:{findUnique:async()=>profile},$transaction:async fn=>fn(tx)});
  service.fetchUserRepositories=async()=>Array.from({length:16},(_,i)=>({repoName:`r${i}`,fullName:`qa/r${i}`,description:'',url:'https://github.com/qa',language:'JavaScript',stars:0,forks:0,topics:[],languages:{JavaScript:10},detectedSkills:[{skillName:'JavaScript',category:'FRONTEND',dependency:'JavaScript',scoreWeight:i===15?5:10}]}));
  await service.syncCandidateGithub('user');
  assert.equal(skillWrites,1);
  assert.equal(evidence.length,16);
  assert.ok(evidence.every(row=>row.commitCount===0&&row.linesOfCode===0));
  assert.deepEqual(staleUpdate.data,{practicalScore:0,verifiedScore:40,isVerified:false});
});

test('Foreign job scope fails before querying any applications; owned scope reaches the database', async () => {
  let query;
  const prisma = {job:{findFirst:async()=>null},jobApplication:{findMany:async args=>{query=args;return[];}}};
  const service = new CompanyService(prisma,{},{});
  service.getCompanyByUserId = async()=>({id:'company'});
  await assert.rejects(service.getApplications('user','foreign'), /unauthorized/);
  assert.equal(query,undefined);
  prisma.job.findFirst = async()=>({id:'owned'});
  await service.getApplications('user','owned');
  assert.deepEqual(query.where.job,{companyId:'company',id:'owned'});
  const attempts=query.include.candidate.include.assessmentAttempts;
  assert.deepEqual(attempts.where.assessment.OR,[{companyId:'company'},{companyId:null}]);
  assert.equal(attempts.select.snapshot,undefined);
  assert.equal(attempts.select.sourceCode,undefined);
});

test('Profile actions use the selected application and exclude another company’s exam evidence', async () => {
  let applicationQuery;
  let candidateQuery;
  const prisma={
    jobApplication:{findFirst:async args=>{applicationQuery=args;return{id:'round-1',status:'CANCELLED'};}},
    candidateProfile:{findUnique:async args=>{candidateQuery=args;return{userId:'candidate-user',assessmentAttempts:[]};}},
  };
  const service=new CompanyService(prisma,{getRadarData:async()=>[]},{});
  service.getCompanyByUserId=async()=>({id:'owner'});
  const result=await service.getCandidateProfile('user','candidate','round-1');
  assert.deepEqual(applicationQuery.where,{id:'round-1',candidateId:'candidate',job:{companyId:'owner'}});
  assert.equal(result.application.id,'round-1');
  const attempts=candidateQuery.include.assessmentAttempts;
  assert.deepEqual(attempts.where.assessment.OR,[{companyId:'owner'},{companyId:null}]);
  for(const field of ['snapshot','sourceCode','draftCode','evaluationSnapshot','answers']) assert.equal(attempts.select[field],undefined);
  candidateQuery=undefined;
  prisma.jobApplication.findFirst=async()=>null;
  await assert.rejects(service.getCandidateProfile('user','candidate','foreign-round'), /only view/);
  assert.equal(candidateQuery,undefined);
});

test('Inactive or incomplete assignments never change the application status', async () => {
  let writes = 0;
  const prisma = {jobApplication:{findUnique:async()=>({job:{companyId:'company'},candidate:{id:'candidate'}}),update:async()=>{writes++;}},assessment:{findFirst:async()=>null}};
  const service = new CompanyService(prisma,{},{});
  service.getCompanyByUserId = async()=>({id:'company'});
  await assert.rejects(service.updateApplicationStatus('user','app','TECHNICAL_TEST',undefined,'closed'));
  prisma.assessment.findFirst = async()=>({id:'broken',title:'QA',type:'THEORY',timeLimitMinutes:10,passingScore:70,questions:[]});
  await assert.rejects(service.updateApplicationStatus('user','app','TECHNICAL_TEST',undefined,'broken'));
  assert.equal(writes,0);
});

test('A withdrawn round cannot be reopened or assigned a test by its company', async () => {
  let writes=0;
  const service=new CompanyService({jobApplication:{findUnique:async()=>({status:'CANCELLED',job:{companyId:'company'}}),update:async()=>{writes++;}}},{},{});
  service.getCompanyByUserId=async()=>({id:'company'});
  await assert.rejects(service.updateApplicationStatus('user','withdrawn','REVIEWING'), /ยกเลิก/);
  await assert.rejects(service.assignAssessmentToApplication('user','withdrawn','assessment'), /ยกเลิก/);
  assert.equal(writes,0);
});

test('Public catalog omits incomplete tests and never sends choices or answer keys', async () => {
  const good = {id:'good',title:'QA',type:'THEORY',timeLimitMinutes:5,passingScore:70,questions:[{title:'Sum',prompt:'What is 1+1?',points:50,choices:[{text:'Two',isCorrect:true},{text:'Three',isCorrect:false}]}]};
  const service = new AssessmentsService({assessment:{findMany:async()=>[good,{...good,id:'broken',questions:[]}]}},{},{});
  const results = await service.findAll();
  assert.deepEqual(results.map(r=>r.id),['good']);
  assert.equal(results[0].questions,undefined);
});


test('Ingestion feedback never calls failed or partial runs a full success', () => {
  const { ingestionFeedback } = require('@smartcareer/shared');
  const failed = ingestionFeedback({status:'FAILED',errorCount:1,errorMessage:'No live jobs returned from JSEARCH'},'JSEARCH','5');
  assert.equal(failed.severity,'error');
  assert.match(failed.message,/ไม่สำเร็จ/);
  assert.match(failed.message,/ไม่เพิ่มข้อมูลตัวอย่าง/);
  const partial = ingestionFeedback({status:'PARTIAL_SUCCESS',createdCount:2,errorCount:1},'UDEMY','5');
  assert.equal(partial.severity,'warning');
  assert.match(partial.message,/สำเร็จบางส่วน/);
  const empty = ingestionFeedback({status:'SUCCESS',createdCount:0,duplicateCount:5,errorCount:0},'REMOTIVE','5');
  assert.equal(empty.severity,'success');
  assert.match(empty.message,/0 สร้างใหม่, 5 รายการเดิม/);
});


test('Course detection requires complete technology names and preserves explicit source tags', () => {
  const { mentionsSkill, courseWithSupportedSkills } = require('../apps/api/dist/recommendations/course-skill-evidence');
  assert.equal(mentionsSkill('JavaScript React coding algorithms', 'Java'), false);
  assert.equal(mentionsSkill('JavaScript React coding algorithms', 'C'), false);
  assert.equal(mentionsSkill('JavaScript React coding algorithms', 'Go'), false);
  for (const name of ['C', 'C#', 'C++', '.NET 8', 'Go']) assert.equal(mentionsSkill(`Learn ${name} fundamentals`,name),true);
  assert.equal(mentionsSkill('ReactJS and NodeJS', 'React'),true);
  const course={title:'JavaScript Course',description:'Learn JavaScript',skills:[
    {skillId:'js',skill:{name:'JavaScript'},relevanceScore:0.9},
    {skillId:'java',skill:{name:'Java'},relevanceScore:0.9},
    {skillId:'c',skill:{name:'C'},relevanceScore:0.9},
    {skillId:'explicit',skill:{name:'C'},relevanceScore:0.95},
  ]};
  assert.deepEqual(courseWithSupportedSkills(course).skills.map(s=>s.skillId),['js','explicit']);
  assert.equal(course.skills.length,4);
});


test('Course filters do not recommend JavaScript courses as Java from old inferred tags', async () => {
  const { RecommendationsService } = require('../apps/api/dist/recommendations/recommendations.service');
  const course={id:'qa',title:'JavaScript Course',description:'Learn JavaScript',url:'https://example.invalid/qa',skills:[{skillId:'java',skill:{name:'Java',category:'BACKEND'},relevanceScore:0.9},{skillId:'js',skill:{name:'JavaScript',category:'FRONTEND'},relevanceScore:0.9}]};
  const service=new RecommendationsService({course:{findMany:async()=>[course]}});
  assert.deepEqual(await service.getAllCourses({skillId:'java'}),[]);
  const matched=await service.getAllCourses({skillId:'js'});
  assert.deepEqual(matched[0].skills.map(s=>s.skillId),['js']);
  assert.equal(course.skills.length,2);
});

function loadPilotUi(file) {
  const fs = require('node:fs'), ts = require('typescript');
  const module = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
  const resolve = name => name === 'next/link' ? {default:props=>require('react').createElement('a',props,props.children)} : require(name);
  new Function('require','module','exports',code)(resolve,module,module.exports);
  return module.exports;
}

test('Theory review keeps original question order, selected answers and genuine zero marks', () => {
  const React = require('react'), {renderToStaticMarkup} = require('react-dom/server');
  const View = loadPilotUi('apps/web/components/TheoryAttemptReview.tsx').default;
  const questions = [
    {id:'b',title:'Second question',prompt:'Second prompt',points:99,choices:[{id:'b1',text:'Correct second answer',isCorrect:true},{id:'b2',text:'Wrong second answer',isCorrect:false}]},
    {id:'a',title:'First question',prompt:'First prompt',points:25,choices:[{id:'a1',text:'Correct first answer',isCorrect:true}]},
  ];
  const html = renderToStaticMarkup(React.createElement(View,{attempt:{assessment:{questions},snapshot:{questions:[{id:'a',points:25},{id:'b',points:25}]},answers:[{questionId:'a',selectedChoiceId:'a1',isCorrect:true,pointsEarned:25},{questionId:'b',selectedChoiceId:'b2',isCorrect:false,pointsEarned:0}]}}));
  assert(html.indexOf('First question') < html.indexOf('Second question'));
  assert.match(html,/Wrong second answer/); assert.match(html,/Correct second answer/);
  assert.match(html,/0 \/ 25 คะแนน/); assert.doesNotMatch(html,/99 คะแนน|Source code|ตรวจโค้ด/);
});

test('Result guidance never reveals hidden or pending feedback and distinguishes exam from selection', () => {
  const React = require('react'), {renderToStaticMarkup} = require('react-dom/server');
  const View = loadPilotUi('apps/web/components/AssessmentResultGuidance.tsx').default;
  const render = props => renderToStaticMarkup(React.createElement(View,{passingScore:70,...props}));
  assert.equal(render({percentage:100,feedbackHidden:true}),'');
  assert.equal(render({percentage:null}),''); assert.equal(render({percentage:NaN}),'');
  const failed=render({percentage:0,skillName:'JavaScript'});
  assert.match(failed,/คะแนน 0% ยังไม่ถึง/); assert.match(failed,/JavaScript/);
  assert.match(failed,/href="\/courses"/); assert.match(failed,/ไม่ใช่คะแนนความเหมาะสมกับงาน/);
  assert.match(render({percentage:100}),/ถึงเกณฑ์ผ่าน 70% แล้ว/);
});

test('Application localization preserves employer notes and unknown statuses', () => {
  const {applicationStatusLabel:label,applicationHistoryNote:note}=loadPilotUi('apps/web/lib/application-status.ts');
  for(const status of ['APPLIED','REVIEWING','INTERVIEW','TECHNICAL_TEST','OFFER','ACCEPTED','REJECTED','CANCELLED']){
    assert.notEqual(label(status,'TH'),status); assert.notEqual(label(status,'EN'),status);
  }
  assert.equal(label('FUTURE_STATUS','TH'),'FUTURE_STATUS');
  assert.equal(note('Status updated to REJECTED','TH'),'เปลี่ยนสถานะเป็นไม่ผ่านการคัดเลือก');
  assert.equal(note('Status updated to REJECTED','EN'),'Status updated to Rejected');
  assert.equal(note('Company note: Status updated to REJECTED','TH'),'Company note: Status updated to REJECTED');
});

test('Review detail permits the owning company and admin but strips marking keys for the candidate', async () => {
  const attempt={id:'qa',candidateId:'candidate',score:25,percentage:50,reviewStatus:'HUMAN_REVIEWED',reviewReason:'Private note',reviewedById:'reviewer',snapshot:{questions:[{id:'q'}]},answers:[{questionId:'q',isCorrect:true}],assessment:{companyId:'company',feedbackVisibility:'AFTER_REVIEW',questions:[{id:'q',choices:[{id:'c',isCorrect:true}]}]}};
  let role='COMPANY', members=[{companyId:'company'}], owner=null;
  const prisma={assessmentAttempt:{findUnique:async query=>{assert.deepEqual(query.include.assessment.include.questions.include.choices.orderBy,{order:'asc'});return attempt;}},user:{findUnique:async()=>({role,companyMembers:members})},candidateProfile:{findUnique:async()=>owner}};
  const service=new AssessmentsService(prisma,{},{});
  assert.equal((await service.getAttemptReviewDetails('qa','company-user')).assessment.questions[0].choices[0].isCorrect,true);
  members=[{companyId:'other-company'}];await assert.rejects(service.getAttemptReviewDetails('qa','outsider'),/Access denied/);
  role='CANDIDATE';members=[];owner={id:'candidate'};
  const candidate=await service.getAttemptReviewDetails('qa','candidate-user');
  assert.equal(candidate.percentage,50); assert.equal(candidate.reviewReason,undefined);
  assert.equal(candidate.answers,undefined);assert.equal(candidate.snapshot,undefined);assert.equal(candidate.assessment.questions,undefined);
  role='ADMIN';owner=null;assert.equal((await service.getAttemptReviewDetails('qa','admin')).reviewReason,'Private note');
});

test('YouTube duration reads only a playable matching main video, ignoring ads and malformed metadata', () => {
  const {youtubeDurationFromHtml:parse}=require('../apps/api/dist/ingestion/youtube-duration');
  const id='cuEtnrL9-H0';
  const html=(details={},status='OK')=>'adData={"lengthSeconds":"99999"}; var ytInitialPlayerResponse = '+JSON.stringify({videoDetails:{videoId:id,lengthSeconds:'395',title:'Title with }; and \\" escapes',...details},playabilityStatus:{status}})+';';
  assert.deepEqual(parse(html(),id),{seconds:395,duration:'6 นาที 35 วินาที'});
  assert.deepEqual(parse(html({lengthSeconds:'30117'}),id),{seconds:30117,duration:'8 ชั่วโมง 21 นาที 57 วินาที'});
  for(const details of [{videoId:'gieEQFIfgYc'},{isLive:true},{lengthSeconds:0},{lengthSeconds:-1},{lengthSeconds:true},{lengthSeconds:'1.5'},{lengthSeconds:'NaN'},{lengthSeconds:'999999999'}]) assert.equal(parse(html(details),id),null);
  assert.equal(parse(html({},'LOGIN_REQUIRED'),id),null);
  assert.equal(parse('ytInitialPlayerResponse = {broken;',id),null);
  assert.equal(parse('<html>Challenge</html>',id),null);
});

test('YouTube fetch does not reuse estimated catalog duration when verification is unavailable', async () => {
  const {IngestionService}=require('../apps/api/dist/ingestion/ingestion.service');
  const service=new IngestionService({}, {}, {});
  service.getCuratedCourses=()=>[{externalId:'yt-qa',url:'https://www.youtube.com/watch?v=cuEtnrL9-H0',title:'QA',duration:'7 hours'}];
  const original=axios.get;
  axios.get=async()=>{throw new Error('isolated network failure');};
  try {const [course]=await service.fetchYouTubeCourses(1);assert.equal(course.duration,null);assert.equal(course.durationVerified,false);}
  finally {axios.get=original;}
});

test('Duplicate course refresh only changes verified duration on the same video and records updated count', async () => {
  const {IngestionService}=require('../apps/api/dist/ingestion/ingestion.service');
  const writes=[], url='https://www.youtube.com/watch?v=cuEtnrL9-H0';
  let incoming={externalId:'qa',url,title:'New title',duration:'6 นาที 35 วินาที',durationVerified:true};
  const existing={id:'qa',url,title:'Keep existing title',duration:'7 hours'};
  const prisma={skill:{findMany:async()=>[]},course:{findFirst:async()=>existing,update:async query=>{writes.push(query);return {...existing,...query.data};}},ingestionLog:{create:async query=>query.data}};
  const service=new IngestionService(prisma,{},{});service.fetchYouTubeCourses=async()=>[incoming];
  const log=await service.syncCourses('YOUTUBE',1);
  assert.deepEqual(writes,[{where:{id:'qa'},data:{duration:'6 นาที 35 วินาที'}}]);
  assert.equal(log.updatedCount,1);assert.equal(log.createdCount,0);assert.equal(log.errorCount,0);
  for(const patch of [{durationVerified:false},{url:'https://www.youtube.com/watch?v=gieEQFIfgYc'}]){
    incoming={...incoming,...patch};await service.syncCourses('YOUTUBE',1);
  }
  assert.equal(writes.length,1);
});
