const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { AuthSecurityService, publicRole, requireJwtSecret, allowedFrontendOrigins } = require('../apps/api/dist/auth/auth-security.service');
const { AuthService } = require('../apps/api/dist/auth/auth.service');
const { RegisterDto } = require('../apps/api/dist/auth/dto/auth.dto');
const { UpdateCandidateProfileDto } = require('../apps/api/dist/candidate/dto/candidate-profile.dto');
const { CreateJobDto } = require('../apps/api/dist/company/dto/job.dto');
const { Judge0Client } = require('../apps/api/dist/assessments/judge0.client');
const axios = require('axios').default;
const { SubmitCompanyVerificationDto } = require('../apps/api/dist/company/dto/company-profile.dto');
const { validateVerificationDocuments } = require('../apps/api/dist/company/verification-documents');

test('Verification rejects missing attachments, malformed IDs and nested file fields', async () => {
  for (const input of [
    { businessRegNo: '123456789012' },
    { businessRegNo: 'abcdefghijklm', documents: { files: [] } },
    { businessRegNo: '1234567890123', documents: { files: [{ name: 'file.pdf', type: 'text/html', size: -1, dataUrl: '', owner: 'other' }] } },
  ]) assert((await validate(plainToInstance(SubmitCompanyVerificationDto, input), { whitelist: true, forbidNonWhitelisted: true })).length);
});

test('Verification rejects corrupted, mislabeled and oversized attachment content', () => {
  const pdf = Buffer.from('%PDF-1.7\nDisposable test document');
  const file = { name: 'test.pdf', type: 'application/pdf', size: pdf.length, dataUrl: 'data:application/pdf;base64,' + pdf.toString('base64') };
  assert.equal(validateVerificationDocuments({ files: [file] }).files.length, 1);
  for (const invalid of [
    { ...file, size: file.size + 1 },
    { ...file, type: 'image/png' },
    { ...file, dataUrl: file.dataUrl + '=' },
    { ...file, dataUrl: 'data:application/pdf;base64,' + Buffer.from('not a PDF').toString('base64'), size: 9 },
  ]) assert.throws(() => validateVerificationDocuments({ files: [invalid] }));
  const large = Buffer.alloc(4 * 1024 * 1024); pdf.copy(large);
  const attachment = { ...file, size: large.length, dataUrl: 'data:application/pdf;base64,' + large.toString('base64') };
  assert.throws(() => validateVerificationDocuments({ files: [attachment, attachment] }));
});

function security() {
  const rows = new Map();
  const prisma = { authChallenge: {
    create: async ({ data }) => { rows.set(data.id, data); return data; },
    findUnique: async ({ where }) => rows.get(where.id),
    deleteMany: async ({ where }) => {
      let count = 0;
      for (const [id, row] of rows) if ((!where.id || where.id === id) && (!where.purpose || row.purpose === where.purpose) &&
        (!where.expiresAt?.gt || row.expiresAt > where.expiresAt.gt) && (!where.expiresAt?.lte || row.expiresAt <= where.expiresAt.lte)) {
        rows.delete(id); count++;
      }
      return { count };
    },
  } };
  const service = new AuthSecurityService(prisma, { get: key => ({ NODE_ENV: 'production', FRONTEND_URL: 'https://smartcareerplatform.vercel.app' }[key]) });
  return { service, rows };
}
const verifier = () => randomBytes(32).toString('base64url');
const challenge = v => createHash('sha256').update(v).digest('base64url');

test('Public signup rejects administrator role at both DTO and service boundaries', async () => {
  assert.throws(() => publicRole('ADMIN'));
  await assert.rejects(new AuthService({}, {}).register({ role: 'ADMIN' }));
  assert((await validate(plainToInstance(RegisterDto, { email: 'test@example.com', password: 'valid-password-123', role: 'ADMIN' }))).some(e => e.property === 'role'));
});
test('Signing key must be configured and cannot use the known placeholder', () => {
  for (const value of [undefined, '', 'short', 'smartcareer_change_in_prod_secret_12345']) assert.throws(() => requireJwtSecret(value));
  assert.equal(requireJwtSecret('a'.repeat(64)).length, 64);
});
test('Only exact frontend origins are allowed, including legacy canonical mapping', () => {
  const { service } = security();
  for (const value of ['https://evil.vercel.app', 'https://smartcareerplatform.vercel.app.evil.test', 'https://smartcareerplatform.vercel.app/path', 'https://evil.test/?localhost']) assert.throws(() => service.frontend(value));
  assert.deepEqual(allowedFrontendOrigins({ get: key => ({ FRONTEND_URL: 'https://smartcareer.vercel.app', NODE_ENV: 'production' }[key]) }), ['https://smartcareerplatform.vercel.app']);
});
test('OAuth state binds provider and browser, rejects expiry and concurrent replay', async () => {
  const { service, rows } = security(); const v = verifier();
  const start = await service.start('github', 'CANDIDATE', undefined, challenge(v));
  await assert.rejects(service.consumeState(start.state, verifier(), 'github'));
  await assert.rejects(service.consumeState(start.state, start.browser, 'google'));
  assert.equal((await Promise.allSettled([service.consumeState(start.state, start.browser, 'github'), service.consumeState(start.state, start.browser, 'github')])).filter(r => r.status === 'fulfilled').length, 1);
  const expired = await service.start('github', 'CANDIDATE', undefined, challenge(v));
  for (const row of rows.values()) row.expiresAt = new Date(0);
  await assert.rejects(service.consumeState(expired.state, expired.browser, 'github'));
});
test('OAuth exchange requires verifier and origin, stores no bearer token and is single use', async () => {
  const { service, rows } = security(); const v = verifier(); const origin = service.frontend();
  const code = await service.grant('user-id', origin, challenge(v));
  assert(!JSON.stringify([...rows.values()]).includes('"token"'));
  await assert.rejects(service.exchange(code, verifier(), origin));
  await assert.rejects(service.exchange(code, v, 'https://evil.vercel.app'));
  assert.equal(await service.exchange(code, v, origin), 'user-id');
  await assert.rejects(service.exchange(code, v, origin));
});
test('Profile mutation rejects ownership fields; job salary and skills are bounded', async () => {
  const errors = await validate(plainToInstance(UpdateCandidateProfileDto, { userId: 'someone-else' }), { whitelist: true, forbidNonWhitelisted: true });
  assert(errors.some(e => e.property === 'userId'));
  assert((await validate(plainToInstance(CreateJobDto, { title: 'Engineer', description: 'Valid description', salaryMin: -1, skills: [{ skillId: 'invalid', minimumScore: 101 }] }))).length >= 2);
});
test('Judge outage fails safely and never evaluates applicant source in the API process', async () => {
  const original = axios.post;
  axios.post = async () => { throw new Error('Simulated provider outage'); };
  try {
    const client = new Judge0Client();
    await assert.rejects(client.executeRaw('throw new Error("applicant source must never run");'), e => e.getStatus() === 503 && e.getResponse().code === 'JUDGE_UNAVAILABLE');
    await assert.rejects(client.execute('function solution() { return 1; }', [{ input: '[]', expectedOutput: '1' }]), e => e.getStatus() === 503);
    assert.equal(client.runLocalFallback, undefined);
    assert.equal(client.runLocalRawFallback, undefined);
  } finally { axios.post = original; }
});
