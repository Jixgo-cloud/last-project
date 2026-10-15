const test = require('node:test');
const assert = require('node:assert/strict');
const { parseJobDetail, jobText, monthlySalary, jobSections } = require('../apps/api/dist/ingestion/job-detail-content');
test('Next serialized JobPosting retains full details, qualifications and location without executing scripts', () => {
  const data = {'@type':'JobPosting', description:'<p>React development '.repeat(100)+'</p>', qualifications:'Docker and SQL',jobLocation:{address:{addressLocality:'Bangkok'}},baseSalary:{currency:'THB',value:{unitText:'MONTH',minValue:30000,maxValue:50000}}};
  const html = `<script>self.__next_s.push(${JSON.stringify([0,{type:'application/ld+json',children:JSON.stringify(data)}])})</script>`;
  const result=parseJobDetail(html,'https://www.jobthai.com/th/company/job/1');
  assert.ok(result.description.length>1000);assert.equal(result.requirements,'Docker and SQL');assert.equal(result.location,'Bangkok');assert.equal(result.salaryMax,50000);
});
test('Reject unrelated recommendation metadata and missing detail', () => {
  assert.throws(()=>parseJobDetail('<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',url:'https://th.jobsdb.com/job/2',description:'a'.repeat(100)})+'</script>','https://th.jobsdb.com/job/1'),/MISSING/);
});
test('JobsDB takes actual job content, excluding recommended cards', () => {
  const result=parseJobDetail('<div data-automation="jobAdDetails"><h2>Requirements</h2><p>'+ 'React '.repeat(20)+'</p></div><aside>Python recommended job</aside>','https://th.jobsdb.com/job/1');
  assert.ok(!result.description.includes('Python'));assert.match(result.requirements,/React/);
});
test('Unknown and annual salary never become monthly salary; sections keep line boundaries', () => {
  assert.deepEqual(monthlySalary({value:{unitText:'YEAR',value:100000}}),{});
  assert.deepEqual(monthlySalary(null),{});
  assert.deepEqual(monthlySalary({currency:'THB',unitText:'MONTH',minValue:'0.00',maxValue:'0.00'}),{});
  assert.deepEqual(monthlySalary({currency:'THB',unitText:'MONTH',minValue:'30000.00',maxValue:'50000.00'}),{salaryMin:30000,salaryMax:50000,salaryCurrency:'THB'});
  assert.equal(jobSections(jobText('<h2>Benefits</h2><p>Annual leave</p>')).benefits,'Annual leave');
  assert.equal(jobSections('What you’ll Need to Succeed:\nPython or Go').requirements,'Python or Go');
});
test('Explicit expired page is not mistaken for a new sparse job', () => {
  assert.throws(()=>parseJobDetail('<body>This job is no longer advertised</body>','https://th.jobsdb.com/job/1'),/SOURCE_LISTING_CLOSED/);
});
test('Named testing and industrial skills are retained without inventing a testing tool', () => {
  const { GeminiExtractorService } = require('../apps/api/dist/ingestion/gemini-extractor.service');
  const skills = new GeminiExtractorService().fallbackRuleBasedExtractor('Software Tester', 'Functional Testing, Load Test, PLC, Test Case').map(s=>s.name);
  for (const name of ['Functional Testing','Load Testing','PLC','Test Case Design']) assert.ok(skills.includes(name));
  assert.ok(!skills.includes('Jest'));
  const nonFunctional = new GeminiExtractorService().fallbackRuleBasedExtractor('Tester', 'Non-Functional Testing').map(s=>s.name);
  assert.ok(!nonFunctional.includes('Functional Testing'));
});
