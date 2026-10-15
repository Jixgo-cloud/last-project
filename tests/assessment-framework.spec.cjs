require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AZ204_FRAMEWORK: catalog, getFrameworkCoverage, getFrameworkValidationError,
  getAssessmentValidationError, assessmentQuestionsMatch, frameworkMetadata, frameworkReferenceChanged,
} = require('@smartcareer/shared');
const { CompanyAssessmentDto } = require('../apps/api/dist/company/dto/assessment.dto');
const { ValidationPipe } = require('@nestjs/common');

const { fixture } = require('./fixtures/az204.cjs');

test('Pinned AZ-204 reference identifies official source, version, retirement and unique topic groups', () => {
  assert.equal(catalog.version, '2026-01-14');
  assert.equal(catalog.retiredOn, '2026-07-31');
  assert.equal(new URL(catalog.sourceUrl).hostname, 'learn.microsoft.com');
  assert.equal(catalog.topics.length, 11);
  assert.equal(new Set(catalog.topics.map(t => t.id)).size, 11);
  assert(catalog.topics.every(t => catalog.domains.some(d => d.id === t.domain)));
});

test('Full coverage uses point totals and passes all 11 objective groups in five domain ranges', () => {
  const input = fixture(), report = getFrameworkCoverage(input);
  assert.equal(getAssessmentValidationError(input), null);
  assert.equal(report.meetsBlueprint, true);
  assert.equal(report.coveredTopics, 11);
  assert.equal(report.totalPoints, 100);
  assert.deepEqual(report.domains.map(d => d.percentage), [30, 20, 20, 10, 20]);
});

test('Practice scope allows a targeted assessment but never claims full coverage', () => {
  const input = fixture(); input.questions = [input.questions[0]]; input.frameworkScope = 'TOPIC_PRACTICE';
  assert.equal(getAssessmentValidationError(input), null);
  const report = getFrameworkCoverage(input);
  assert.equal(report.meetsBlueprint, false);
  assert.equal(report.missingTopics.length, 10);
  input.frameworkScope = 'FULL_BLUEPRINT';
  assert.match(getAssessmentValidationError(input), /ครบ 11/);
});

test('Duplicating a topic cannot inflate distinct-topic coverage', () => {
  const input = fixture(); input.questions = Array.from({ length: 11 }, () => ({ ...input.questions[0] }));
  const report = getFrameworkCoverage(input);
  assert.equal(report.coveredTopics, 1);
  assert.equal(report.topicCoveragePercentage, 100 / 11);
  assert.equal(report.domains[0].percentage, 100);
  assert.equal(report.meetsBlueprint, false);
});

test('All topics without balanced points cannot pass blueprint checks', () => {
  const input = fixture(); input.questions[0].points = 100;
  const report = getFrameworkCoverage(input);
  assert.equal(report.coveredTopics, 11);
  assert.equal(report.meetsBlueprint, false);
  assert.match(getFrameworkValidationError(input), /สัดส่วน/);
});

test('Coverage does not round an out-of-range percentage into compliance', () => {
  const input = fixture(); input.questions.forEach(q => { q.points *= 100; }); input.questions[0].points += 1;
  const report = getFrameworkCoverage(input);
  assert(report.domains[0].percentage > 30);
  assert.equal(report.domains[0].withinRange, false);
});

test('Unmapped and unknown topics remain in denominator and are reported by question number', () => {
  const input = fixture(); input.questions[0].frameworkTopicId = 'made-up';
  const report = getFrameworkCoverage(input);
  assert.deepEqual(report.unmappedQuestions, [1]);
  assert.equal(report.totalPoints, 100);
  assert.equal(report.domains[0].percentage, 20);
  assert.match(getFrameworkValidationError(input), /ข้อที่ 1/);
});

test('Empty, nonfinite and zero-point content cannot claim coverage', () => {
  for (const value of [0, -1, 0.5, 10001, NaN, Infinity]) {
    const input = fixture(); input.questions[0].points = value;
    assert.equal(getFrameworkCoverage(input).meetsBlueprint, false);
    assert(getAssessmentValidationError(input));
  }
  const empty = { ...fixture(), questions: [] };
  assert.equal(getFrameworkCoverage(empty).topicCoveragePercentage, 0);
  assert.equal(getFrameworkCoverage(empty).meetsBlueprint, false);
});

test('Unsupported framework, version and scope fail validation rather than silently dropping reference', () => {
  for (const [key, value] of [['frameworkCode', 'AZ-999'], ['frameworkVersion', '2023'], ['frameworkScope', 'CERTIFIED']]) {
    assert(getFrameworkValidationError({ ...fixture(), [key]: value }));
  }
});

test('Author mapping explanation is required, bounded and not inferred from skill names', () => {
  for (const note of ['', 'Docker', ' '.repeat(30), 123, 'x'.repeat(2001)]) {
    const input = fixture(); input.questions[0].frameworkMappingNote = note;
    assert(getFrameworkValidationError(input));
  }
});

test('Existing assessments remain valid without references; orphan mappings are rejected', () => {
  const input = fixture(); Object.assign(input, frameworkMetadata({}));
  assert(getFrameworkValidationError(input));
  input.questions = input.questions.map(({ frameworkTopicId, frameworkMappingNote, ...q }) => q);
  assert.equal(getAssessmentValidationError(input), null);
  assert.equal(getFrameworkCoverage(input), null);
});

test('Question equality protects topic and mapping note once candidates have started', () => {
  const questions = fixture().questions;
  assert(assessmentQuestionsMatch(questions, structuredClone(questions)));
  for (const key of ['frameworkTopicId', 'frameworkMappingNote']) {
    const changed = structuredClone(questions); changed[0][key] = 'changed';
    assert.equal(assessmentQuestionsMatch(questions, changed), false);
  }
});

test('Partial updates preserve reference, explicit clearing is distinguishable and changes are detected', () => {
  const input = fixture();
  assert.equal(frameworkReferenceChanged(input, {}), false);
  assert.equal(frameworkReferenceChanged(input, { frameworkScope: 'TOPIC_PRACTICE' }), true);
  assert.equal(frameworkReferenceChanged(input, frameworkMetadata({})), true);
  assert.deepEqual(frameworkMetadata({}, input), frameworkMetadata(input));
});

test('Strict API DTO accepts reference fields, rejects invalid IDs and does not strip them', async () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const input = fixture(); input.questions.forEach(q => delete q.id);
  const converted = await pipe.transform(input, { type: 'body', metatype: CompanyAssessmentDto });
  assert.equal(converted.frameworkVersion, input.frameworkVersion);
  assert.equal(converted.questions[0].frameworkTopicId, 'compute.containers');
  await assert.rejects(pipe.transform({ ...input, frameworkCode: 'AZ-999' }, { type: 'body', metatype: CompanyAssessmentDto }));
});
