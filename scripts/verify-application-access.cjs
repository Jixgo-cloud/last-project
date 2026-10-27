// Read-only integration verification against an existing isolated staging database.
// Usage: node scripts/verify-application-access.cjs <private-staging-config.json>
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { ApplicationsService } = require('../apps/api/dist/applications/applications.service');
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const url = new URL(config.databaseUrl);
assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Only isolated localhost database allowed');
assert(url.pathname.includes('staging'), 'Staging database name required');
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
(async () => {
  const before = await db.assessmentAttempt.count();
  const application = await db.jobApplication.findFirst({ where: { job: { company: { members: { some: {} } } } },
    include: { candidate: true, job: { include: { company: { include: { members: true } } } } } });
  assert(application, 'A staging application with a company member is required');
  const service = new ApplicationsService(db);
  const owner = await service.getApplicationById(application.id, application.candidate.userId, 'CANDIDATE');
  assert.equal(owner.id, application.id);
  assert.deepEqual(Object.keys(owner.candidate.user).sort(), ['avatarUrl', 'email', 'id']);
  const company = await service.getApplicationById(application.id, application.job.company.members[0].userId, 'COMPANY');
  assert.equal(company.id, application.id);
  for (const role of ['CANDIDATE', 'COMPANY']) {
    await assert.rejects(service.getApplicationById(application.id, '00000000-0000-0000-0000-000000000000', role), e => e.getStatus() === 404);
  }
  assert.equal(await db.assessmentAttempt.count(), before);
  console.log(JSON.stringify({ passed: true, checks: ['candidate-owner', 'company-member', 'candidate-outsider-404', 'company-outsider-404', 'no-authentication-secrets', 'attempt-count-unchanged'], databaseWrites: 0 }));
})().catch(() => { console.error('Application access verification failed; private error details suppressed'); process.exitCode = 1; })
  .finally(() => db.$disconnect());
