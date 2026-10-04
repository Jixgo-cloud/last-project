const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios').default;
const { getAttemptPercentage } = require('@smartcareer/shared');
const { candidateFeedback } = require('../apps/api/dist/assessments/candidate-feedback');
const { GithubService } = require('../apps/api/dist/github/github.service');
const { CompanyService } = require('../apps/api/dist/company/company.service');
const { AssessmentsService } = require('../apps/api/dist/assessments/assessments.service');

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

test('Public catalog omits incomplete tests and never sends choices or answer keys', async () => {
  const good = {id:'good',title:'QA',type:'THEORY',timeLimitMinutes:5,passingScore:70,questions:[{title:'Sum',prompt:'What is 1+1?',points:50,choices:[{text:'Two',isCorrect:true},{text:'Three',isCorrect:false}]}]};
  const service = new AssessmentsService({assessment:{findMany:async()=>[good,{...good,id:'broken',questions:[]}]}},{},{});
  const results = await service.findAll();
  assert.deepEqual(results.map(r=>r.id),['good']);
  assert.equal(results[0].questions,undefined);
});
