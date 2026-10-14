const test = require('node:test');
const assert = require('node:assert/strict');
const { EvaluationsService } = require('../apps/api/dist/evaluations/evaluations.service');
const { RecommendationsService } = require('../apps/api/dist/recommendations/recommendations.service');
const { companyEvaluationView } = require('../apps/api/dist/evaluations/company-evaluation-view');

test('Company responses exclude private candidate journals without modifying stored progress', () => {
  const stored={id:'e',areasForImprovement:{version:1,skillIds:['react'],note:'Company goal',updatedAt:'revision',progress:{react:{note:'Private journal',evidenceUrl:'https://example.test/private'}}}};
  const output=companyEvaluationView(stored);
  assert.equal(output.areasForImprovement.progress,undefined);
  assert.equal(output.areasForImprovement.note,'Company goal');
  assert.equal(stored.areasForImprovement.progress.react.note,'Private journal');
});

test('Company feedback validates scores and skills, enforces ownership and saves real development inputs', async () => {
  let saved, owner = 'c1', persisted = null;
  const notifications = [];
  const prisma = {
    companyMember: { findFirst: async () => ({ companyId: 'c1' }) },
    jobApplication: { findUnique: async () => ({ candidateId: 'p1', job: { companyId: owner } }) },
    skill: { findMany: async ({where}) => where.id.in.includes('react') ? [{ id: 'react', name: 'React' }] : [] },
    companyEvaluation: { findUnique: async () => persisted, upsert: async data => { saved = data; persisted = {id:'evaluation',...(persisted ? {...persisted,...data.update} : data.create)}; return persisted; } },
    candidateProfile: { findUnique: async () => ({userId:'candidate-user'}) },
    notification: { create: async ({data}) => {notifications.push(data);return data;} },
    $queryRaw: async () => [],
  };
  prisma.$transaction = async fn => fn(prisma);
  const service = new EvaluationsService(prisma);
  const input = { technicalScore: 2, problemSolvingScore: 3, communicationScore: 4, teamworkScore: 5, overallFeedback: ' Practice hooks ', developmentSkillIds: ['react'], developmentNote: 'Build a React form', strengths: ['Explains clearly'] };
  await assert.rejects(service.evaluateCandidate('u','a',{...input,technicalScore:6}), e => e.getStatus()===400);
  owner='other';await assert.rejects(service.evaluateCandidate('u','a',input), e => e.getStatus()===403);assert.equal(saved,undefined);
  owner='c1';await assert.rejects(service.evaluateCandidate('u','a',{...input,developmentSkillIds:['missing']}), e => e.getStatus()===400);
  await service.evaluateCandidate('u','a',input);
  assert.deepEqual(saved.create.areasForImprovement.skillIds,['react']);assert.equal(saved.create.overallFeedback,'Practice hooks');
  assert.equal(notifications[0].userId,'candidate-user');assert.equal(notifications[0].metadata.action,'CREATED');
  await service.evaluateCandidate('u','a',input);assert.equal(notifications.length,1,'Identical retries must not notify again');
  persisted.areasForImprovement.progress={react:{status:'IN_PROGRESS',note:'keep me'}};
  await service.evaluateCandidate('u','a',{...input,developmentSkillIds:[],developmentNote:''});
  assert.deepEqual(saved.update.areasForImprovement.skillIds,[]);
  assert.equal(saved.update.areasForImprovement.progress.react.note,'keep me');
  assert.equal(notifications[1].metadata.action,'UPDATED');
});

test('Learning progress is owned, bounded, revision checked and independent of scores', async () => {
  let owned=true, writes=0, locked=false;
  const row={id:'evaluation',applicationId:'application',areasForImprovement:{version:1,updatedAt:'revision1',skillIds:['react','docker'],note:'Company goal'}};
  const tx={
    $queryRaw:async()=>{locked=true;return[];},
    companyEvaluation:{findFirst:async({where})=>{assert.equal(where.candidate.userId,'owner');return owned?row:null;},
      findUnique:async()=>{assert(locked);return row;},
      update:async({data})=>{assert.deepEqual(Object.keys(data),['areasForImprovement']);writes++;Object.assign(row,data);return row;}}
  };
  const service=new RecommendationsService({$transaction:async fn=>fn(tx)});
  const input={status:'IN_PROGRESS',note:'Learn hooks',evidenceUrl:'https://github.com/qa/project',revision:'revision1',expectedUpdatedAt:null};
  owned=false;await assert.rejects(service.updateLearningProgress('owner','evaluation','react',input),e=>e.getStatus()===404);assert.equal(writes,0);
  owned=true;
  for(const invalid of [{status:'OTHER'},{evidenceUrl:'javascript:alert(1)'},{evidenceUrl:'https://user:password@example.com'},{note:'x'.repeat(2001)},{extra:true}]) {
    await assert.rejects(service.updateLearningProgress('owner','evaluation','react',{...input,...invalid}),e=>e.getStatus()===400);
  }
  await assert.rejects(service.updateLearningProgress('owner','evaluation','missing',input),e=>e.getStatus()===404);
  await assert.rejects(service.updateLearningProgress('owner','evaluation','react',{...input,revision:'old'}),e=>e.getStatus()===409);
  const first=await service.updateLearningProgress('owner','evaluation','react',input);
  assert.equal(first.status,'IN_PROGRESS');assert.equal(row.areasForImprovement.note,'Company goal');
  await assert.rejects(service.updateLearningProgress('owner','evaluation','react',input),e=>e.getStatus()===409);
  await service.updateLearningProgress('owner','evaluation','docker',{...input,status:'COMPLETED'});
  assert.equal(row.areasForImprovement.progress.react.note,'Learn hooks');assert(row.areasForImprovement.progress.docker.completedAt);
  const finished=await service.updateLearningProgress('owner','evaluation','react',{...input,status:'COMPLETED',expectedUpdatedAt:first.updatedAt});
  assert(finished.completedAt);
  const reopened=await service.updateLearningProgress('owner','evaluation','react',{...input,expectedUpdatedAt:finished.updatedAt});
  assert.equal(reopened.completedAt,null);
});

test('Personal development plan uses only owned explicit feedback, matches courses and never writes skill scores', async () => {
  let scope;
  const evaluation = {id:'e',applicationId:'a',company:{name:'QA'},application:{job:{title:'Developer'}},createdAt:new Date(),technicalScore:2,problemSolvingScore:3,communicationScore:4,teamworkScore:5,overallFeedback:'Practice',strengths:['Clear'],areasForImprovement:{version:1,skillIds:['react'],note:'Build a form',updatedAt:new Date().toISOString()}};
  const service = new RecommendationsService({
    candidateProfile:{findUnique:async ({where}) => {assert.equal(where.userId,'owner');return {id:'p1'};}},
    companyEvaluation:{findMany:async ({where})=>{scope=where;return [evaluation,{...evaluation,id:'legacy',areasForImprovement:['System scalability']}];}},
    skill:{findMany:async()=>[{id:'react',name:'React'}]},
    course:{findMany:async()=>[
      {id:'c1',title:'React forms',url:'https://example.test/react',skills:[],provider:'YOUTUBE'},
      {id:'c2',title:'Docker',url:'https://example.test/docker',skills:[],provider:'YOUTUBE'},
      {id:'c3',title:'React forms',url:'javascript:alert(1)',skills:[],provider:'YOUTUBE'},
    ]},
  });
  const plan = await service.getDevelopmentPlan('owner');assert.deepEqual(scope,{candidateId:'p1'});
  assert.equal(plan.evaluations[0].skills[0].recommendedCourses.length,1);
  assert.equal(plan.evaluations[0].skills[0].recommendedCourses[0].id,'c1');
  assert.equal(plan.evaluations[0].skills[0].steps.length,4);
  assert.equal(plan.evaluations[1].legacy,true);assert.deepEqual(plan.evaluations[1].skills,[]);
});
const {codingScreeningResult,filterCodingApplications,evidenceWeightedScore}=require('@smartcareer/shared');
test('Radar has no invented baseline and only evidenced GitHub scores contribute',()=>{
  assert.equal(evidenceWeightedScore({practicalScore:100,theoryScore:0,codingScore:0,evidences:[]}),0);
  assert.equal(evidenceWeightedScore({practicalScore:80,theoryScore:50,codingScore:100,evidences:[{repositoryId:'r'}]}),80);
  assert.equal(evidenceWeightedScore({codingScore:50}),15);
  assert.equal(evidenceWeightedScore({practicalScore:100,evidences:[{repositoryId:'r'},{repositoryId:'r'}]}),50);
  assert.equal(evidenceWeightedScore({theoryScore:NaN,codingScore:-5}),0);
});
test('Coding screening uses graded real percentages, includes zero, and scopes assigned exams',()=>{
 const attempt=(id,score,status='COMPLETED',type='PRACTICAL_CODING')=>({id,assessmentId:id,startedAt:'2026-10-14',status,score,maxScore:50,assessment:{type,title:id}});
 const attempts=[attempt('theory',50,'COMPLETED','THEORY'),attempt('pending',50,'IN_PROGRESS'),{...attempt('review',50),reviewStatus:'PENDING_HUMAN_REVIEW'},attempt('coding',25),attempt('zero',0)];
 assert.equal(codingScreeningResult(attempts).percentage,50);
 assert.equal(codingScreeningResult(attempts,{id:'zero',type:'PRACTICAL_CODING'}).percentage,0);
 assert.equal(codingScreeningResult(attempts,{id:'missing',type:'PRACTICAL_CODING'}),null);
 assert.equal(codingScreeningResult([{...attempt('human',0),humanScore:90}]).percentage,90);
});
test('Coding filters distinguish absent from zero and sort absent last without mutating input',()=>{
 const apps=[{id:'none',codingResult:null},{id:'zero',codingResult:{percentage:0}},{id:'high',codingResult:{percentage:100}},{id:'mid',codingResult:{percentage:50}}];
 assert.deepEqual(filterCodingApplications(apps,'','ASC').map(a=>a.id),['zero','mid','high','none']);
 assert.deepEqual(filterCodingApplications(apps,'','DESC').map(a=>a.id),['high','mid','zero','none']);
 assert.deepEqual(filterCodingApplications(apps,'70','DESC').map(a=>a.id),['high']);
 assert.deepEqual(filterCodingApplications(apps,'NONE','LATEST').map(a=>a.id),['none']);
 assert.equal(filterCodingApplications(apps,'0','LATEST').length,3);
 assert.equal(apps[0].id,'none');
});
test('Radar averages measured skill scores per category and leaves absent categories at zero',async()=>{
 const {CandidateService}=require('../apps/api/dist/candidate/candidate.service');
 const service=new CandidateService({candidateProfile:{findUnique:async()=>({skills:[
  {skill:{category:'FRONTEND'},codingScore:100,theoryScore:50,practicalScore:100,evidences:[]},
  {skill:{category:'FRONTEND'},codingScore:0,theoryScore:0,practicalScore:100,evidences:[]}
 ]})}});
 const radar=await service.getRadarData('qa');
 assert.equal(radar.length,5);assert.equal(radar.find(p=>p.category==='FRONTEND').score,20);
 assert.equal(radar.find(p=>p.category==='BACKEND').score,0);
});
test('Coding result survives more than five newer unrelated exams',()=>{
 const attempts=Array.from({length:8},(_,i)=>({id:'t'+i,assessmentId:'t'+i,startedAt:'2026-10-14',status:'COMPLETED',percentage:100,assessment:{type:'THEORY'}}));
 attempts.push({id:'coding',assessmentId:'coding',startedAt:'2026-10-01',status:'COMPLETED',percentage:65,assessment:{type:'PRACTICAL_CODING'}});
 assert.equal(codingScreeningResult(attempts).percentage,65);
});
