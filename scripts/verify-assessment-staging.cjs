// Real Judge0 smoke tests against the explicitly isolated local staging only.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const bank = require('../prisma/assessment-bank/javascript-sandbox.json');
const file = path.join(os.homedir(), '.codex/smartcareer-assessment-staging.json');
const cfg = JSON.parse(fs.readFileSync(file));
const url = new URL(cfg.databaseUrl);
assert(['localhost','127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/smartcareer_assessment_staging_'));
assert.equal(cfg.apiUrl,'http://127.0.0.1:4100/api'); assert.equal(cfg.webUrl,'http://localhost:3100');
const stage = process.argv[2] || 'before'; assert(['before','gap','pass','history','criterion'].includes(stage));
const checkOnly = process.argv.includes('--check-only');
assert(stage !== 'criterion' || checkOnly, 'Criterion scenario is submitted through the UI');
const expectedScore = stage === 'pass' ? 100 : stage === 'criterion' ? 65 : 50;
const db = new PrismaClient({datasources:{db:{url:cfg.databaseUrl}}});
function save() { fs.writeFileSync(file, JSON.stringify(cfg,null,2), {mode:0o600}); }
async function request(route, body, token = cfg.testUser?.token) {
  const r = await fetch(cfg.apiUrl+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});
  const data=await r.json();assert(r.ok,`${route}: HTTP ${r.status} ${JSON.stringify(data)}`);return data;
}
(async()=>{
  if (stage === 'before' && process.argv.includes('--fresh-candidate')) {
    cfg.qaCandidateIds = [...new Set([...(cfg.qaCandidateIds || []), cfg.testUser?.candidateId].filter(Boolean))];
    delete cfg.testUser;
    delete cfg.legacyFixtureId;
    cfg.qaEmail = `assessment-v3-${Date.now()}@smartcareer.test`;
  }
  if(!cfg.testUser) {
    const auth=await request('/auth/dev-callback',{provider:'github',role:'CANDIDATE',email:cfg.qaEmail || 'assessment-staging-qa@smartcareer.test',fullName:'Assessment Staging QA',githubUsername:cfg.qaEmail ? cfg.qaEmail.split('@')[0] : 'assessment-staging-qa'});
    cfg.testUser={id:auth.id,candidateId:auth.candidateProfile.id,token:auth.token,email:auth.email};save();
    await db.candidateProfile.update({where:{id:auth.candidateProfile.id},data:{targetCareer:'Full Stack Developer'}});
  }
  const assessment=await db.assessment.findUniqueOrThrow({where:{id:cfg.assessmentId},include:{questions:true}});
  assert.equal(assessment.questions.length,2);assert.equal(assessment.version,bank.version);
  if(!cfg.jobId) {
    const job=await db.job.findFirstOrThrow({where:{isActive:true,title:'Full Stack Developer (Next.js / NestJS)',skills:{some:{skill:{slug:'javascript'}}}},include:{skills:true}});
    cfg.jobId=job.id;cfg.jobSkillCount=job.skills.length;save();
  }
  const report={stage,checkedAt:new Date().toISOString(),provider:cfg.provider,api:cfg.apiUrl,web:cfg.webUrl,productionWrites:false};
  if(stage==='history') {
    const admin=await db.user.upsert({where:{email:'assessment-staging-reviewer@example.invalid'},create:{email:'assessment-staging-reviewer@example.invalid',role:'ADMIN'},update:{}});
    const token=jwt.sign({sub:admin.id,email:admin.email,role:admin.role},cfg.jwtSecret,{expiresIn:'15m'});
    const review=await request('/assessments/attempts/'+cfg.historicalAttemptId+'/review',undefined,token);
    assert.equal(review.assessment.questions.length,1);assert.equal(review.assessment.version,1);
    assert.equal(review.score,50);assert.equal(review.maxScore,50);assert.equal(review.percentage,100);
    const archive=await db.assessmentBankRevision.findUniqueOrThrow({where:{assessmentId_version:{assessmentId:assessment.id,version:1}}});
    assert.equal(review.assessment.questions[0].prompt,archive.snapshot.questions[0].prompt);
    // A labelled staging-only copy lets QA inspect the historical candidate screen without signing in as a real user.
    if(!cfg.legacyFixtureId) {
      const original=await db.assessmentAttempt.findUniqueOrThrow({where:{id:cfg.historicalAttemptId},include:{answers:true}});
      const {id,candidateId,answers,...data}=original;
      const fixture=await db.assessmentAttempt.create({data:{...data,candidateId:cfg.testUser.candidateId,
        answers:{create:answers.map(({id,attemptId,...answer})=>answer)}}});
      cfg.legacyFixtureId=fixture.id;save();
    }
    const candidate=await request('/assessments/attempts/'+cfg.legacyFixtureId+'/review');
    assert.equal(candidate.resultScope.questionCount,1);assert.equal(candidate.maxScore,50);assert.equal(candidate.percentage,100);
    assert.equal(candidate.assessment.questions,undefined);assert.equal(candidate.snapshot,undefined);
    if(!cfg.historyUiUser) {
      const auth=await request('/auth/dev-callback',{provider:'github',role:'CANDIDATE',email:'assessment-history-qa@smartcareer.test',fullName:'Assessment History QA',githubUsername:'assessment-history-qa'});
      cfg.historyUiUser={id:auth.id,candidateId:auth.candidateProfile.id,token:auth.token};save();
      await db.candidateProfile.update({where:{id:auth.candidateProfile.id},data:{targetCareer:'Full Stack Developer'}});
    }
    if(!cfg.historyUiFixtureId) {
      const original=await db.assessmentAttempt.findUniqueOrThrow({where:{id:cfg.historicalAttemptId},include:{answers:true}});
      const {id,candidateId,answers,...data}=original;
      const copy=await db.assessmentAttempt.create({data:{...data,candidateId:cfg.historyUiUser.candidateId,
        answers:{create:answers.map(({id,attemptId,...answer})=>answer)}}});
      cfg.historyUiFixtureId=copy.id;save();
    }
    const historyUser = await db.user.findUniqueOrThrow({where:{id:cfg.historyUiUser.id}});
    cfg.historyUiUser.token = jwt.sign({sub:historyUser.id,email:historyUser.email,role:historyUser.role},cfg.jwtSecret,{expiresIn:'1h'});
    save();
    const unknown=await request('/jobs/'+cfg.jobId+'/match',undefined,cfg.historyUiUser.token);
    assert.equal(unknown.matchScore,null);assert.equal(unknown.status,'AWAITING_ASSESSMENT');
    report.history={archivedQuestionCount:1,score:review.score,maxScore:review.maxScore,percentage:review.percentage,version:review.assessmentVersion,qaCopy:cfg.legacyFixtureId};
  } else {
    const route='/assessments/'+assessment.id;
    const candidateExam=await request(route);
    assert(candidateExam.questions.every(q=>q.solutionCode===undefined && q.testCases.filter(t=>t.isHidden).every(t=>t.input===undefined && t.expectedOutput===undefined)));
    if(stage!=='before' && !checkOnly) {
      const attempt=await request(route+'/start',{});cfg.attemptId=attempt.id;save();report.submissions=[];
      for(const authored of bank.questions) {
        const q=assessment.questions.find(q=>q.title===authored.title);
        const sourceCode=stage==='pass'||q.title.includes('Two Sum')?authored.solutionCode:"function solution(str) { return 'unimplemented'; }";
        const run=await request(route+'/run-code',{attemptId:attempt.id,questionId:q.id,sourceCode});
        assert.equal(run.engine,'Judge0-Isolated-Container');
        assert.equal(run.totalTestCases,q.testCases.filter(t=>!t.isHidden).length);
        const result=await request(route+'/submit-coding',{attemptId:attempt.id,questionId:q.id,sourceCode});
        assert.equal(result.execution.engine,'Judge0-Isolated-Container');
        assert.equal(result.execution.passedTestCases,stage==='pass'||q.title.includes('Two Sum')?q.testCases.length:0);
        assert(result.execution.details.every(d=>typeof d.timeMs==='number'));
        assert(result.execution.details.filter(d=>d.isHidden).every(d=>d.expected==='[Hidden]'));
        report.submissions.push({question:q.title,visibleCases:run.totalTestCases,passed:result.execution.passedTestCases,total:result.execution.totalTestCases,engine:result.execution.engine});
      }
      const persisted=await db.assessmentAttempt.findUniqueOrThrow({where:{id:attempt.id},include:{answers:true}});
      assert.equal(persisted.status,'COMPLETED');assert.equal(persisted.percentage,expectedScore);
      assert.equal(persisted.maxScore,100);assert.equal(persisted.snapshot.questions.length,2);assert.equal(persisted.snapshot.skill.id,assessment.skillId);
      report.result={status:persisted.status,score:persisted.score,maxScore:persisted.maxScore,percentage:persisted.percentage,version:persisted.assessmentVersion,answerCount:persisted.answers.length};
    }
    const match=await request('/jobs/'+cfg.jobId+'/match');
    const recommendations=await request('/recommendations/skill-gaps');
    const detail=await request('/jobs/'+cfg.jobId+'/detail');
    const profile=await request('/candidate/profile');
    const js=recommendations.assessmentPlan.find(p=>p.skillName==='JavaScript');assert(js);
    assert.deepEqual(detail.matchScore,match);
    assert.equal(match.totalSkills,cfg.jobSkillCount);
    if(stage==='before') {
      assert.equal(match.matchScore,null);assert.equal(match.status,'AWAITING_ASSESSMENT');assert.equal(match.assessedCount,0);
      assert.equal(js.currentLevel,null);assert.equal(js.status,'NOT_ASSESSED');assert.equal(recommendations.gaps.length,0);
    } else {
      const latest=await db.assessmentAttempt.findFirstOrThrow({where:{candidateId:cfg.testUser.candidateId,assessmentId:assessment.id,status:'COMPLETED'},orderBy:{startedAt:'desc'},include:{answers:true}});
      assert.equal(latest.assessmentVersion,bank.version);assert.equal(latest.maxScore,100);assert.equal(latest.percentage,expectedScore);
      assert.equal(latest.answers.length,2);assert.equal(latest.snapshot.questions.length,2);
      assert(latest.answers.every(a=>a.executionResult.engine==='Judge0-Isolated-Container'));
      if(stage==='pass') assert(latest.answers.every(a=>a.executionResult.passedTestCases===a.executionResult.totalTestCases));
      report.result={score:latest.score,maxScore:latest.maxScore,percentage:latest.percentage,version:latest.assessmentVersion,answerCount:latest.answers.length};
      report.executions=latest.answers.map(a=>({questionId:a.questionId,pointsEarned:a.pointsEarned,engine:a.executionResult.engine,passed:a.executionResult.passedTestCases,total:a.executionResult.totalTestCases}));
      assert.equal(match.status,'PRELIMINARY');assert.equal(match.assessedCount,1);
      assert.equal(match.unassessedSkills.length,cfg.jobSkillCount-1);assert(match.unassessedSkills.every(s=>s.userScore===null));
      assert.equal(js.currentLevel,expectedScore);assert.equal(js.status,stage==='pass'?'ASSESSED':'GAP');
      assert.equal(profile.skills.find(s=>s.skillId===assessment.skillId).assessmentScore,js.currentLevel);
      if(stage==='gap'||stage==='criterion') {assert.equal(recommendations.gaps.length,1);assert(recommendations.gaps[0].recommendedCourses.length>0);}
      else {assert.equal(match.matchScore,100);assert.equal(recommendations.gaps.length,0);assert.equal(detail.recommendedCourses.length,0);}
    }
    report.match=match;report.javaScript=js;report.gaps=recommendations.gaps.map(g=>({skill:g.skillName,courses:g.recommendedCourses.length}));
  }
  // Exclude only explicitly created QA candidates; original production-copy results must be byte-for-byte unchanged.
  const baseline=JSON.parse(fs.readFileSync(path.join(cfg.dir,'migration-evidence.json')));
  for(const table of ['assessment_attempts','assessment_answers','job_applications']) {
    const condition=table==='assessment_answers'
      ? 't."attemptId" IN (SELECT id FROM assessment_attempts WHERE "candidateId" <> ALL($1::text[]))'
      : 't."candidateId" <> ALL($1::text[])';
    const rows=await db.$queryRawUnsafe(`SELECT to_jsonb(t) - ARRAY['matchAssessmentSnapshot'] AS data FROM ${table} t WHERE ${condition}`,[cfg.testUser.candidateId,cfg.historyUiUser?.candidateId,...(cfg.qaCandidateIds || [])].filter(Boolean));
    const fingerprint=createHash('sha256').update(rows.map(r=>JSON.stringify(r.data)).sort().join('\n')).digest('hex');
    assert.equal(rows.length,baseline.before[table].rows,table+' original row count');
    assert.equal(fingerprint,baseline.before[table].hash,table+' original content');
  }
  report.originalResultsUnchanged=true;
  const out=path.join(cfg.dir,`live-${stage}.json`);fs.writeFileSync(out,JSON.stringify(report,null,2),{mode:0o600});
  console.log(JSON.stringify({stage,passed:true,provider:cfg.provider,score:report.result?.percentage,coverage:report.match?`${report.match.assessedCount}/${report.match.totalSkills}`:undefined,gaps:report.gaps,history:report.history,report:out}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
