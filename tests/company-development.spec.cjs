const test = require('node:test');
const assert = require('node:assert/strict');
const { EvaluationsService } = require('../apps/api/dist/evaluations/evaluations.service');
const { RecommendationsService } = require('../apps/api/dist/recommendations/recommendations.service');

test('Company feedback validates scores and skills, enforces ownership and saves real development inputs', async () => {
  let saved, owner = 'c1';
  const prisma = {
    companyMember: { findFirst: async () => ({ companyId: 'c1' }) },
    jobApplication: { findUnique: async () => ({ candidateId: 'p1', job: { companyId: owner } }) },
    skill: { findMany: async ({where}) => where.id.in.includes('react') ? [{ id: 'react', name: 'React' }] : [] },
    companyEvaluation: { upsert: async data => { saved = data; return data.create; } },
  };
  const service = new EvaluationsService(prisma);
  const input = { technicalScore: 2, problemSolvingScore: 3, communicationScore: 4, teamworkScore: 5, overallFeedback: ' Practice hooks ', developmentSkillIds: ['react'], developmentNote: 'Build a React form', strengths: ['Explains clearly'] };
  await assert.rejects(service.evaluateCandidate('u','a',{...input,technicalScore:6}), e => e.getStatus()===400);
  owner='other';await assert.rejects(service.evaluateCandidate('u','a',input), e => e.getStatus()===403);assert.equal(saved,undefined);
  owner='c1';await assert.rejects(service.evaluateCandidate('u','a',{...input,developmentSkillIds:['missing']}), e => e.getStatus()===400);
  await service.evaluateCandidate('u','a',input);
  assert.deepEqual(saved.create.areasForImprovement.skillIds,['react']);assert.equal(saved.create.overallFeedback,'Practice hooks');
  await service.evaluateCandidate('u','a',{...input,developmentSkillIds:[],developmentNote:''});
  assert.deepEqual(saved.update.areasForImprovement.skillIds,[]);
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
