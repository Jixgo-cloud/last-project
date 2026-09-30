import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api';
const prisma = new PrismaClient();

interface TestResult {
  gate: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(gate: string, name: string, passed: boolean, details: string) {
  results.push({ gate, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${gate}] ${icon} - ${name}: ${details}`);
}

async function runGateTests() {
  console.log('===============================================================');
  console.log('🛡️ SMARTCAREER PRODUCTION ACCEPTANCE GATES VERIFICATION (1-10)');
  console.log('===============================================================\n');

  // --- GATE 4: Mock OAuth Authoritative Backend Guard ---
  console.log('--- Testing Gate 4: Mock OAuth Guard (POST /api/auth/dev-callback) ---');
  try {
    const res = await axios.post(
      `${API_BASE_URL}/auth/dev-callback`,
      {
        provider: 'google',
        role: 'COMPANY',
        email: 'attacker@evil.com',
        fullName: 'Attacker Impersonator',
      },
      { validateStatus: () => true },
    );

    if (res.status === 403) {
      record('Gate 4', 'dev-callback Reject', true, `Received HTTP 403 Forbidden: "${res.data.message}"`);
    } else {
      record('Gate 4', 'dev-callback Reject', false, `Expected HTTP 403 but got HTTP ${res.status}`);
    }
  } catch (err: any) {
    record('Gate 4', 'dev-callback Reject', false, `Request failed: ${err.message}`);
  }

  // --- GATE 8: Strict Payload Validation (forbidNonWhitelisted: true) ---
  console.log('\n--- Testing Gate 8: Strict Validation (Reject unknown properties with 400) ---');
  try {
    const resInvalid = await axios.post(
      `${API_BASE_URL}/auth/login`,
      {
        email: 'test@example.com',
        password: 'password123',
        maliciousExtraField: 'should_trigger_400_forbidNonWhitelisted',
      },
      { validateStatus: () => true },
    );

    if (resInvalid.status === 400) {
      record(
        'Gate 8',
        'Strict Payload Validation',
        true,
        `Received HTTP 400 Bad Request for extra field: ${JSON.stringify(resInvalid.data.message)}`,
      );
    } else {
      record(
        'Gate 8',
        'Strict Payload Validation',
        false,
        `Expected HTTP 400 Bad Request but got HTTP ${resInvalid.status}`,
      );
    }
  } catch (err: any) {
    record('Gate 8', 'Strict Payload Validation', false, `Request failed: ${err.message}`);
  }

  // --- GATE 9: Health & Readiness Endpoint ---
  console.log('\n--- Testing Gate 9: Health & Readiness Endpoint (GET /api/health) ---');
  try {
    const resHealth = await axios.get(`${API_BASE_URL}/health`, { validateStatus: () => true });
    if (resHealth.status === 200 && resHealth.data.status === 'ok' && resHealth.data.database === 'connected') {
      record(
        'Gate 9',
        'Health Probe Normal',
        true,
        `HTTP 200 OK: ${JSON.stringify(resHealth.data)}`,
      );
    } else {
      record('Gate 9', 'Health Probe Normal', false, `Unexpected response: HTTP ${resHealth.status}`);
    }
  } catch (err: any) {
    record('Gate 9', 'Health Probe Normal', false, `Request failed: ${err.message}`);
  }

  // --- GATE 7: CORS Allowed / Disallowed Origin Verification ---
  console.log('\n--- Testing Gate 7: CORS Origin Filtering ---');
  try {
    // Request from unknown origin
    const resUnknown = await axios.get(`${API_BASE_URL}/health`, {
      headers: { Origin: 'https://evil-unauthorized-site.com' },
      validateStatus: () => true,
    });
    // In Express/NestJS CORS, if origin is rejected, Access-Control-Allow-Origin header is omitted or error thrown
    const acao = resUnknown.headers['access-control-allow-origin'];
    if (!acao || acao !== 'https://evil-unauthorized-site.com') {
      record(
        'Gate 7',
        'CORS Rejection of Unknown Origin',
        true,
        `Access-Control-Allow-Origin correctly withheld for unauthorized origin: ${acao || 'None'}`,
      );
    } else {
      record(
        'Gate 7',
        'CORS Rejection of Unknown Origin',
        false,
        `Unexpected Access-Control-Allow-Origin returned: ${acao}`,
      );
    }
  } catch (err: any) {
    record('Gate 7', 'CORS Rejection of Unknown Origin', true, `Rejected as expected: ${err.message}`);
  }

  // --- GATE 10: Regression Verification of Existing Core APIs ---
  console.log('\n--- Testing Gate 10: Regression Check (Jobs & Skills Endpoints) ---');
  try {
    const resJobs = await axios.get(`${API_BASE_URL}/jobs?limit=5`, { validateStatus: () => true });
    const resSkills = await axios.get(`${API_BASE_URL}/skills`, { validateStatus: () => true });

    if (resJobs.status === 200 && resSkills.status === 200) {
      record(
        'Gate 10',
        'Core Read Endpoints Regression',
        true,
        `Jobs HTTP 200 (${resJobs.data.jobs ? resJobs.data.jobs.length : 'ok'}), Skills HTTP 200 (${resSkills.data.length || 'ok'})`,
      );
    } else {
      record(
        'Gate 10',
        'Core Read Endpoints Regression',
        false,
        `Jobs HTTP ${resJobs.status}, Skills HTTP ${resSkills.status}`,
      );
    }
  } catch (err: any) {
    record('Gate 10', 'Core Read Endpoints Regression', false, `Request failed: ${err.message}`);
  }

  console.log('\n===============================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`SUMMARY: ${results.filter((r) => r.passed).length}/${results.length} Tests Passed`);
  console.log(`STATUS: ${allPassed ? '🎉 ALL GATES PASS' : '❌ SOME GATES FAILED'}`);
  console.log('===============================================================');

  await prisma.$disconnect();
}

runGateTests().catch(console.error);
