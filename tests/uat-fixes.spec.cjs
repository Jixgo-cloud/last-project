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
const { AssessmentsService } = require('../apps/api/dist/assessments/assessments.service');
const { honestJobContent } = require('../apps/api/dist/jobs/job-content');
const { IngestionService } = require('../apps/api/dist/ingestion/ingestion.service');
const { JobsService } = require('../apps/api/dist/jobs/jobs.service');
const { legacySampleJobIds } = require('../apps/api/dist/jobs/legacy-sample-jobs');

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
  await service.syncJobs('REMOTIVE',1);
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
  const result=await service.syncJobs('REMOTIVE',1);
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
      const input = { score:50, percentage:100, humanScore:100, passed:true, snapshot:{secret:true}, answers:[{isCorrect:true}], evaluationSnapshot:{secret:true}, reviewStatus, assessment:{companyId:'company', feedbackVisibility:visibility, questions:[{solutionCode:'secret'}]} };
      const output = candidateFeedback(input);
      const hidden = visibility === 'PRIVATE_TO_COMPANY' || (visibility === 'AFTER_REVIEW' && reviewStatus !== 'HUMAN_REVIEWED');
      assert.equal(output.feedbackHidden, hidden);
      assert.equal(output.percentage, hidden ? null : 100);
      assert.equal(output.snapshot, undefined);
      assert.equal(output.answers, undefined);
      assert.equal(output.assessment.questions, undefined);
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
