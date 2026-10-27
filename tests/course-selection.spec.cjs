const test = require('node:test');
const assert = require('node:assert/strict');
const { courseIdentity, uniqueCourses, selectRelevantCourses } = require('../apps/api/dist/recommendations/course-selection');
const course = (id, title, url, description = '') => ({ id, title, url, description });

test('Course identity collapses tracking and YouTube aliases, preserving distinct resources', () => {
  assert.equal(courseIdentity('https://www.udemy.com/course/javascript/?couponCode=SALE&utm_source=test#lesson'), courseIdentity('http://udemy.com/course/javascript'));
  assert.equal(courseIdentity('https://youtu.be/abcdefghijk?si=share'), courseIdentity('https://www.youtube.com/watch?v=abcdefghijk&t=42'));
  assert.notEqual(courseIdentity('https://example.com/course?id=1'), courseIdentity('https://example.com/course?id=2'));
  assert.notEqual(courseIdentity('https://example.com/JS'), courseIdentity('https://example.com/js'));
  for (const url of ['javascript:alert(1)', 'not a URL', 'https://user:password@example.com/course']) assert.equal(courseIdentity(url), null);
});

test('Relevance filters before deduplication and limits; title evidence outranks incidental description', () => {
  const rows = [
    course('irrelevant', 'Career advice', 'https://example.com/js'),
    course('broad', 'Full stack', 'https://example.com/full', 'Includes JavaScript and React'),
    course('direct', 'JavaScript fundamentals', 'https://example.com/js?utm_source=test'),
    course('duplicate', 'JavaScript fundamentals', 'https://www.example.com/js/#intro'),
    course('other', 'Java course', 'https://example.com/java'),
    course('unsafe', 'JavaScript', 'javascript:alert(1)'),
  ];
  assert.deepEqual(selectRelevantCourses(rows, ['JavaScript'], 2).map(c => c.id), ['direct', 'broad']);
  assert.deepEqual(selectRelevantCourses(rows, [], 3), []);
  assert.equal(rows.length, 6);
  assert.equal(uniqueCourses([rows[2], rows[3]])[0].url, rows[2].url);
});

test('Company development plan rejects stale skill tags without textual evidence and deduplicates aliases', async () => {
  const { RecommendationsService } = require('../apps/api/dist/recommendations/recommendations.service');
  const service = new RecommendationsService({
    candidateProfile: { findUnique: async () => ({ id: 'candidate' }) },
    companyEvaluation: { findMany: async () => [{ id:'evaluation', company:{name:'QA'}, application:{job:{title:'QA'}}, areasForImprovement:{version:1,skillIds:['js']} }] },
    skill: { findMany: async () => [{ id:'js', name:'JavaScript' }] },
    course: { findMany: async () => [
      {...course('bad','Docker','https://example.com/docker'),skills:[{skillId:'js',skill:{name:'JavaScript'},relevanceScore:1}]},
      course('a','JavaScript basics','https://example.com/js'),
      course('b','JavaScript basics','https://example.com/js/?ref=duplicate'),
    ] },
  });
  const plan = await service.getDevelopmentPlan('owner');
  assert.deepEqual(plan.evaluations[0].skills[0].recommendedCourses.map(c=>c.id), ['a']);
});
