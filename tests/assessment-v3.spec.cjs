const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const bank = require('../prisma/assessment-bank/javascript-sandbox.json');
const { automatedRubricScore } = require('../apps/api/dist/assessments/automated-rubric');
const { Judge0Client } = require('../apps/api/dist/assessments/judge0.client');
const { getAssessmentValidationError } = require('@smartcareer/shared');
function grade(q, code) {
  const details = q.testCases.map(tc => {
    const result = vm.runInNewContext(code + '; solution(...args)', { args: JSON.parse(tc.input) }, { timeout: 100 });
    return { passed: typeof result === tc.returnType && String(result) === tc.expectedOutput };
  });
  return automatedRubricScore(q.points, q.testCases, details, q.rubric).pointsEarned;
}
test('v3 references satisfy all criteria including Unicode before lowercase', () => {
  assert.equal(bank.version, 3);
  for (const q of bank.questions) assert.equal(grade(q, q.solutionCode), 50);
});
test('readiness accepts intentional typed empty output but rejects unspecified blank output', () => {
  const assessment = {title:'Draft',type:'PRACTICAL_CODING',timeLimitMinutes:30,passingScore:70,questions:bank.questions};
  assert.equal(getAssessmentValidationError(assessment),null);
  const invalid = structuredClone(assessment);
  const empty = invalid.questions[0].testCases.find(tc=>tc.expectedOutput === '');
  delete empty.returnType;
  assert.match(getAssessmentValidationError(invalid),/ผลลัพธ์ที่คาดหวัง/);
});
test('essential mistakes cannot be compensated by a perfect other question', () => {
  const [a,b] = bank.questions;
  const mutants = [
    [a, a.solutionCode.replace('seen.set(nums[j], j);', 'if (!seen.has(nums[j])) seen.set(nums[j], j);')],
    [a, a.solutionCode.replace("return '';", "return '0,1';")],
    [b, 'function solution() { return true; }'],
    [b, b.solutionCode.replace('[^A-Za-z0-9]', '[^A-Za-z]')],
    [b, 'function solution() { return "true"; }'],
  ];
  for (const [q,code] of mutants) assert(grade(q, code) + 50 < 70);
});
test('legacy proportional scoring and invalid rubric behavior', () => {
  assert.equal(automatedRubricScore(50, [{},{}], [{passed:true},{passed:false}], {}).pointsEarned,25);
  assert.throws(() => automatedRubricScore(50, [{}], [], {}), /Incomplete/);
  assert.throws(() => automatedRubricScore(50, [{}], [{passed:true}], bank.questions[0].rubric), /Invalid/);
});
test('actual JS harness rejects string boolean but keeps legacy output contract', () => {
  const client = new Judge0Client();
  const run = type => {
    const process = {};
    const logs = [];
    vm.runInNewContext(client.wrapSourceCode('function solution() { return "true"; }', '["aba"]', 63, type),
      { process, console: { log: v => logs.push(v), error: () => {} } }, { timeout: 100 });
    return { process, logs };
  };
  assert.equal(run('boolean').process.exitCode,1);
  assert.deepEqual(run(undefined).logs,['true']);
});
test('Judge0 outage records SYSTEM_ERROR without a fabricated score or answer', async () => {
  const { AssessmentsService } = require('../apps/api/dist/assessments/assessments.service');
  const updates = [];
  const attempt = {id:'qa',status:'IN_PROGRESS',startedAt:new Date(),reviewStatus:'NOT_REQUIRED',assessment:{companyId:null,timeLimitMinutes:30,passingScore:70,
    questions:[{...bank.questions[0],id:'q'}]}};
  const service = new AssessmentsService({assessmentAttempt:{updateMany:async()=>({count:1}),update:async({data})=>updates.push(data)},
    $transaction:()=>assert.fail('No grading write on outage')}, {execute:async()=>{throw new Error('JUDGE_UNAVAILABLE');}}, {});
  service.validateAttemptOwnership = async()=>attempt;
  await assert.rejects(service.submitCodingSolution('qa','q','user','function solution() { return ""; }'),/JUDGE_UNAVAILABLE/);
  assert(updates.some(u=>u.status==='SYSTEM_ERROR'));
  assert(updates.every(u=>u.score===undefined && u.percentage===undefined));
});
