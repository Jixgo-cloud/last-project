/* AI-authored answer simulation; does not connect to the application database. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const raw = fs.readFileSync(path.join(root, 'prisma/assessment-bank/javascript-sandbox.json'));
const bank = JSON.parse(raw);
const [two, pal] = bank.questions;
const { automatedRubricScore } = require('../apps/api/dist/assessments/automated-rubric');
const variants = [
  { id: 'two-reference', q: two, code: two.solutionCode },
  { id: 'two-first-earlier', q: two, code: two.solutionCode.replace('seen.set(nums[j], j);', 'if (!seen.has(nums[j])) seen.set(nums[j], j);') },
  { id: 'two-wrong-no-pair', q: two, code: two.solutionCode.replace("return '';", "return '0,1';") },
  { id: 'pal-reference', q: pal, code: pal.solutionCode },
  { id: 'pal-always-true', q: pal, code: 'function solution(str) { return true; }' },
  { id: 'pal-ignore-digits', q: pal, code: pal.solutionCode.replace('[^a-z0-9]', '[^a-z]').replace('[^A-Za-z0-9]', '[^A-Za-z]') },
  { id: 'pal-string-return', q: pal, code: pal.solutionCode.replace("return clean === clean.split('').reverse().join('');", "return String(clean === clean.split('').reverse().join('')); ") },
];
const probes = {
  'two-reference': [{ input: '["1,1,2",3]', expectedOutput: '1,2' }, { input: '["1,2,3",99]', expectedOutput: '' }],
  'two-first-earlier': [{ input: '["1,1,2",3]', expectedOutput: '1,2' }],
  'two-wrong-no-pair': [{ input: '["1,2,3",99]', expectedOutput: '' }],
  'pal-reference': [{ input: '["Ka"]', expectedOutput: 'true' }, { input: '["İa"]', expectedOutput: 'true' }],
  'pal-always-true': [{ input: '["ab"]', expectedOutput: 'false' }],
  'pal-ignore-digits': [{ input: '["a1"]', expectedOutput: 'false' }],
  'pal-string-return': [{ input: '["aba"]', expectedOutput: 'true', expectedType: 'boolean' }],
};
function evaluate(code, cases) {
  return cases.map(tc => {
    // Only repository reference code and the fixed, authored variants above are run locally.
    const result = vm.runInNewContext(code + '; solution(...args)', { args: JSON.parse(tc.input) }, { timeout: 100 });
    const expectedType = tc.expectedType || tc.returnType;
    return { passed: String(result) === tc.expectedOutput && (!expectedType || typeof result === expectedType), actualType: typeof result };
  });
}
async function main() {
  const live = process.argv.includes('--live');
  const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
  const report = { generatedAt: new Date().toISOString(), reviewType: 'AI_SIMULATION_NOT_HUMAN_PILOT', bankVersion: bank.version, bankSha256: crypto.createHash('sha256').update(raw).digest('hex'), live, results: [] };
  let client;
  if (live) {
    // Public CE endpoint: never forward any inherited service credentials.
    process.env.JUDGE0_BASE_URL = 'https://ce.judge0.com';
    delete process.env.JUDGE0_API_KEY;
    delete process.env.RAPIDAPI_KEY;
    const { Judge0Client } = require('../apps/api/dist/assessments/judge0.client.js');
    client = new Judge0Client();
  }
  const out = path.join(root, 'output/assessment-quality-review');
  fs.mkdirSync(out, { recursive: true });
  for (const variant of variants) {
    if (only && variant.id !== only) continue;
    const localBank = evaluate(variant.code, variant.q.testCases);
    const row = { id: variant.id, bankCases: localBank.length, localPassed: localBank.filter(x => x.passed).length, probeResults: evaluate(variant.code, probes[variant.id]) };
    row.questionPoints = automatedRubricScore(variant.q.points, variant.q.testCases, localBank, variant.q.rubric).pointsEarned;
    row.combinedScoreWithOtherCorrect = Math.round(row.questionPoints + 50);
    if (client) {
      try {
        const result = await client.execute(variant.code, variant.q.testCases, { maskHiddenDetails: true, languageId: 63 });
        row.judge0 = { passed: result.passedTestCases, total: result.totalTestCases, status: result.status, engine: result.engine };
        // A stdout harness cannot check return types; that probe remains local and is labelled as such.
        const cases = probes[variant.id].filter(tc => !tc.expectedType);
        if (cases.length) {
          const probe = await client.execute(variant.code, cases, { languageId: 63 });
          row.judge0Probes = { passed: probe.passedTestCases, total: probe.totalTestCases, status: probe.status };
        }
      } catch (error) {
        row.infrastructureError = error.message;
        process.exitCode = 1;
      }
    }
    report.results.push(row);
    fs.writeFileSync(path.join(out, 'v' + bank.version + '-' + (live ? 'live' : 'local') + (only ? '-' + only : '') + '.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(row));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
