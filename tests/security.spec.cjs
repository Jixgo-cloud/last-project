const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { AuthSecurityService, publicRole, requireJwtSecret, allowedFrontendOrigins } = require('../apps/api/dist/auth/auth-security.service');
const { AuthService } = require('../apps/api/dist/auth/auth.service');
const { HealthController } = require('../apps/api/dist/health/health.controller');
const { RegisterDto } = require('../apps/api/dist/auth/dto/auth.dto');
const { UpdateCandidateProfileDto } = require('../apps/api/dist/candidate/dto/candidate-profile.dto');
const { CreateJobDto } = require('../apps/api/dist/company/dto/job.dto');
const { Judge0Client } = require('../apps/api/dist/assessments/judge0.client');
const axios = require('axios').default;
const { SubmitCompanyVerificationDto } = require('../apps/api/dist/company/dto/company-profile.dto');
const { validateVerificationDocuments } = require('../apps/api/dist/company/verification-documents');
const { VerificationQueryDto } = require('../apps/api/dist/admin/dto/verification-query.dto');
const { VerificationReviewDto } = require('../apps/api/dist/admin/dto/verification-review.dto');
const { CompanyService } = require('../apps/api/dist/company/company.service');

test('Company document downloads select only owned requests and preserve bytes and safe filenames', async () => {
  const bytes = Buffer.from('%PDF-QA test file');
  const documents = {files:[{name:'../เอกสาร\nQA.pdf',type:'application/pdf',size:bytes.length,dataUrl:'data:application/pdf;base64,'+bytes.toString('base64')}]};
  let query;
  const service = new CompanyService({companyVerification:{findFirst:async args => {
    query=args;
    return args.where.companyId==='company-a' && args.where.id==='request-a' ? {documents} : null;
  }}}, {}, {});
  service.getCompanyByUserId=async userId => ({id:userId==='owner-a'?'company-a':'company-b'});
  const file = await service.downloadVerificationDocument('owner-a','request-a',0);
  assert.deepEqual(query.where,{id:'request-a',companyId:'company-a'});
  const chunks=[]; for await(const chunk of file.getStream())chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks),bytes);
  assert.equal(file.getHeaders().type,'application/pdf');
  assert.equal(file.getHeaders().length,bytes.length);
  assert(!file.getHeaders().disposition.includes('\n'));
  await assert.rejects(service.downloadVerificationDocument('owner-b','request-a',0),error=>error.getStatus()===404);
  for (const index of [-1,1,0.5]) await assert.rejects(service.downloadVerificationDocument('owner-a','request-a',index));
  documents.files[0].size++;
  await assert.rejects(service.downloadVerificationDocument('owner-a','request-a',0),error=>error.getStatus()===400);
});

test('Company profile attachment metadata never returns embedded file content', async () => {
  const service = new CompanyService({}, {}, {});
  service.getCompanyByUserId=async()=>({id:'company-a',verifications:[{id:'request-a',documents:{files:[{name:'QA.png',type:'image/png',size:5,dataUrl:'data:image/png;base64,PRIVATE-BYTES'}]}}]});
  const profile=await service.getProfile('owner-a');
  assert.equal(profile.verifications[0].documents.files[0].dataUrl,'/api/company/verifications/request-a/documents/0');
  assert(!JSON.stringify(profile).includes('PRIVATE-BYTES'));
});

test('Readiness reports the deployed revision and never exposes connection errors or invalid metadata', async () => {
  const previous = process.env.RAILWAY_GIT_COMMIT_SHA;
  let status;
  const response = { status: code => { status = code; return response; }, json: data => data };
  try {
    process.env.RAILWAY_GIT_COMMIT_SHA = 'a'.repeat(40);
    const ready = await new HealthController({ $queryRaw: async () => [{ value: 1 }] }).getHealth(response);
    assert.equal(status, 200);
    assert.equal(ready.revision, 'a'.repeat(40));
    process.env.RAILWAY_GIT_COMMIT_SHA = 'invalid-private-metadata';
    const down = await new HealthController({ $queryRaw: async () => { throw new Error('private-connection-details'); } }).getHealth(response);
    assert.equal(status, 503);
    assert.equal(down.revision, null);
    assert(!JSON.stringify(down).includes('private'));
  } finally {
    if (previous === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
    else process.env.RAILWAY_GIT_COMMIT_SHA = previous;
  }
});

test('Verification review requires a bounded reason for rejection and rejects unknown fields', async () => {
  for (const input of [{ action: 'REJECT' }, { action: 'REJECT', reason: '   ' }, { action: 'REJECT', reason: 42 }, { action: 'REJECT', reason: 'x'.repeat(2001) }, { action: 'INVALID' }, { action: 'APPROVE', companyId: 'other' }]) {
    assert((await validate(plainToInstance(VerificationReviewDto, input), { whitelist: true, forbidNonWhitelisted: true })).length);
  }
  const input = plainToInstance(VerificationReviewDto, { action: 'REJECT', reason: '  กรุณาแนบเอกสารที่อ่านได้ชัดเจน  ' });
  assert.equal((await validate(input)).length, 0);
  assert.equal(input.reason, 'กรุณาแนบเอกสารที่อ่านได้ชัดเจน');
  assert.equal((await validate(plainToInstance(VerificationReviewDto, { action: 'APPROVE' }))).length, 0);
});

test('Verification pagination rejects invalid limits, statuses and unknown query fields', async () => {
  for (const input of [{ page: '0' }, { page: '1.5' }, { pageSize: '51' }, { status: 'INVALID' }, { paginated: 'yes' }, { includeDocuments: 'true' }]) {
    assert((await validate(plainToInstance(VerificationQueryDto, input), { whitelist: true, forbidNonWhitelisted: true })).length);
  }
  const query = plainToInstance(VerificationQueryDto, { page: '2', pageSize: '10', status: 'PENDING', paginated: 'true' });
  assert.equal((await validate(query)).length, 0);
  assert.equal(query.page, 2);
  assert.equal(query.pageSize, 10);
});

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
  const limit = require('@smartcareer/shared').VERIFICATION_MAX_BYTES;
  const boundary = Buffer.alloc(limit); pdf.copy(boundary);
  const maximum = { ...file, size: boundary.length, dataUrl: 'data:application/pdf;base64,' + boundary.toString('base64') };
  assert.equal(validateVerificationDocuments({ files: [maximum] }).files[0].size, limit);
  assert(Buffer.byteLength(JSON.stringify({ businessRegNo: '1234567890123', documents: { files: [maximum] } })) < 4.5 * 1000 * 1000);
  const large = Buffer.alloc(2 * 1024 * 1024); pdf.copy(large);
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
test('Email registration is disabled for both public roles without creating accounts', async () => {
  const service = new AuthService({}, {});
  for (const role of ['CANDIDATE', 'COMPANY']) {
    await assert.rejects(service.register({ email: 'qa@example.test', password: 'valid-password-123', role }),
      error => error.getStatus() === 400 && error.message.includes(role === 'CANDIDATE' ? 'GitHub' : 'Google'));
  }
});
test('New public accounts are created only by their matching OAuth provider', async () => {
  for (const [role, provider] of [['CANDIDATE', 'GITHUB'], ['COMPANY', 'GOOGLE']]) {
    let saved;
    const service = new AuthService({ candidateProfile: { findUnique: async () => null }, user: {
      findUnique: async () => null, create: async ({ data }) => {
        saved = data;
        return { ...data, id: 'new-id', candidateProfile: data.candidateProfile ? { ...data.candidateProfile.create, id: 'new-profile' } : null,
          companyMembers: data.companyMembers ? [{ company: { ...data.companyMembers.create.company.create, id: 'new-company' } }] : [] };
      },
    } }, { sign: () => 'test-token' });
    const dto = { requestedRole: role, email: 'qa@example.test', providerId: 'new-identity', githubUsername: 'qa-new' };
    await assert.rejects(service.handleOAuthUser({ ...dto, provider: provider === 'GITHUB' ? 'GOOGLE' : 'GITHUB' }));
    assert.equal(saved, undefined);
    assert.equal((await service.handleOAuthUser({ ...dto, provider })).role, role);
    assert.equal(saved.passwordHash, null);
    assert.equal(saved.authProvider, provider);
    assert(role === 'CANDIDATE' ? saved.candidateProfile : saved.companyMembers);
  }
});
test('Legacy public passwords cannot sign in; administrator passwords still work', async () => {
  const passwordHash = await require('bcryptjs').hash('qa-password-123', 4);
  for (const role of ['CANDIDATE', 'COMPANY', 'ADMIN']) {
    let issued = 0;
    const user = { id: 'qa-id', email: 'qa@example.test', role, isActive: true, passwordHash, candidateProfile: null, companyMembers: [] };
    const service = new AuthService({ user: { findUnique: async () => user } }, { sign: () => { issued++; return 'test-token'; } });
    if (role === 'ADMIN') {
      await assert.rejects(service.login({ email: user.email, password: 'incorrect' }));
      assert.equal((await service.login({ email: user.email, password: 'qa-password-123' })).role, 'ADMIN');
      assert.equal(issued, 1);
    } else {
      await assert.rejects(service.login({ email: user.email, password: 'qa-password-123' }), error => error.getStatus() === 401);
      assert.equal(issued, 0);
    }
  }
});
test('OAuth keeps existing account data and rejects cross-role providers and admin social login', async () => {
  for (const role of ['CANDIDATE', 'COMPANY', 'ADMIN']) {
    const user = { id: 'existing-id', email: 'qa@example.test', role, isActive: true, authProvider: 'LOCAL',
      candidateProfile: role === 'CANDIDATE' ? { id: 'existing-profile', githubUsername: 'qa-existing', fullName: 'QA' } : null,
      companyMembers: role === 'COMPANY' ? [{ company: { id: 'existing-company', name: 'QA', verificationStatus: 'PENDING' } }] : [] };
    const service = new AuthService({ user: { findUnique: async () => user,
      update: async ({ data }) => Object.assign(user, data) } }, { sign: () => 'test-token' });
    const dto = { email: user.email, providerId: 'provider-id', githubUsername: 'qa-existing' };
    if (role === 'ADMIN') {
      await assert.rejects(service.handleOAuthUser({ ...dto, provider: 'GOOGLE' }));
      continue;
    }
    await assert.rejects(service.handleOAuthUser({ ...dto, provider: role === 'CANDIDATE' ? 'GOOGLE' : 'GITHUB' }));
    const result = await service.handleOAuthUser({ ...dto, provider: role === 'CANDIDATE' ? 'GITHUB' : 'GOOGLE' });
    assert.equal(result.id, 'existing-id');
    assert.equal(role === 'CANDIDATE' ? result.candidateProfile.id : result.company.id, role === 'CANDIDATE' ? 'existing-profile' : 'existing-company');
    await assert.rejects(service.handleOAuthUser({ ...dto, provider: role === 'CANDIDATE' ? 'GITHUB' : 'GOOGLE', providerId: 'different-identity' }));
  }
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
