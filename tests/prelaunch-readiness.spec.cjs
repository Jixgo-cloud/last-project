const test = require('node:test');
const assert = require('node:assert/strict');
const { ApplicationsService } = require('../apps/api/dist/applications/applications.service');
const { ApplicationsController } = require('../apps/api/dist/applications/applications.controller');
const { NotificationsService } = require('../apps/api/dist/notifications/notifications.service');

test('unexpected application errors never forward private database details to logs or response', async () => {
  const service = new ApplicationsService({ candidateProfile: { findUnique: async () => { throw new Error('private-cover-letter'); } } });
  const logs = [];
  service.logger = { error: (...args) => logs.push(args) };
  await assert.rejects(service.applyJob('user', 'job', {}), e => e.getStatus() === 500 && !e.stack.includes('private-cover-letter'));
  assert.deepEqual(logs, [['Application submission failed']]);
  const missing = new ApplicationsService({ candidateProfile: { findUnique: async () => null } });
  await assert.rejects(missing.applyJob('user', 'job', {}), e => e.getStatus() === 404);
});

test('application controller forwards authenticated identity and role', async () => {
  let args;
  const controller = new ApplicationsController({ getApplicationById: async (...values) => { args = values; } });
  await controller.getOne('application', { user: { id: 'owner', role: 'CANDIDATE' } });
  assert.deepEqual(args, ['application', 'owner', 'CANDIDATE']);
});

for (const role of ['CANDIDATE', 'COMPANY', 'ADMIN']) {
  test(`application lookup scopes ${role} and excludes authentication secrets`, async () => {
    let query;
    const stored = { id: 'a', evaluation: { areasForImprovement: { version: 1, note: 'feedback', progress: { private: 'journal' } } } };
    const service = new ApplicationsService({ jobApplication: { findFirst: async q => { query = q; return stored; } } });
    const result = await service.getApplicationById('a', 'owner', role);
    assert.deepEqual(query.where, role === 'ADMIN' ? { id: 'a' } : role === 'CANDIDATE'
      ? { id: 'a', candidate: { userId: 'owner' } }
      : { id: 'a', job: { company: { members: { some: { userId: 'owner' } } } } });
    assert.deepEqual(query.include.candidate.include.user, { select: { id: true, email: true, avatarUrl: true } });
    assert.equal(result.evaluation.areasForImprovement.progress?.private, role === 'COMPANY' ? undefined : 'journal');
    assert.equal(stored.evaluation.areasForImprovement.progress.private, 'journal');
  });
}

test('missing or inaccessible application returns 404; invalid identities fail before querying', async () => {
  let calls = 0;
  const service = new ApplicationsService({ jobApplication: { findFirst: async () => { calls++; return null; } } });
  for (const role of ['CANDIDATE', 'COMPANY']) {
    await assert.rejects(service.getApplicationById('other-application', 'stranger', role), e => e.getStatus() === 404);
  }
  assert.equal(calls, 2);
  for (const [id, role] of [['', 'ADMIN'], ['user', 'UNKNOWN']]) {
    await assert.rejects(service.getApplicationById('a', id, role), e => e.getStatus() === 404);
  }
  assert.equal(calls, 2);
});

test('notifications enforce bounded positive page sizes and preserve owner filter', async () => {
  const service = new NotificationsService({ notification: { findMany: async q => q } });
  for (const [input, expected] of [[NaN, 30], [Infinity, 30], [-4, 1], [0, 1], [2.8, 2], [1000000, 100], [undefined, 30]]) {
    const query = await service.getUserNotifications('owner', input);
    assert.equal(query.take, expected);
    assert.deepEqual(query.where, { userId: 'owner' });
  }
});
