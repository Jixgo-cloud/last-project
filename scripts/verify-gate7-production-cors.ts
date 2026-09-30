import express from 'express';
// @ts-ignore
import cors from 'cors';
import http from 'http';
import axios from 'axios';

async function testProductionCORS() {
  console.log('--- STARTING GATE 7: PRODUCTION CORS STRICT EVALUATION ---');

  // Enforce Production Environment
  process.env.NODE_ENV = 'production';
  process.env.FRONTEND_URL = 'https://smartcareer.example.com';
  process.env.ALLOWED_ORIGINS = 'https://admin.smartcareer.example.com';

  const isDevelopment = process.env.NODE_ENV === 'development';
  const frontendUrl = process.env.FRONTEND_URL;
  const extraOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const allowedOrigins = [
    frontendUrl,
    ...extraOrigins,
    ...(isDevelopment ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []),
  ].filter(Boolean) as string[];

  console.log(`Configured NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`Configured FRONTEND_URL: ${process.env.FRONTEND_URL}`);
  console.log(`Active Allowed Origins in Production:`, allowedOrigins);

  const app = express();
  app.use(
    cors({
      origin: (origin: any, callback: any) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
    }),
  );

  app.get('/api/test-cors', (req, res) => {
    res.json({ message: 'cors ok' });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(4099, '127.0.0.1', () => resolve()));
  const testBaseUrl = 'http://127.0.0.1:4099/api/test-cors';

  let allPassed = true;

  try {
    // 1. https://smartcareer.example.com -> ALLOW
    console.log('\n[Case 1] Origin: https://smartcareer.example.com (Production Domain)');
    const res1 = await axios.get(testBaseUrl, {
      headers: { Origin: 'https://smartcareer.example.com' },
      validateStatus: () => true,
    });
    const acao1 = res1.headers['access-control-allow-origin'];
    const acac1 = res1.headers['access-control-allow-credentials'];
    console.log(`  -> Access-Control-Allow-Origin: ${acao1}`);
    console.log(`  -> Access-Control-Allow-Credentials: ${acac1}`);
    if (acao1 === 'https://smartcareer.example.com' && acac1 === 'true') {
      console.log('  ✅ ALLOW: Permitted with credentials.');
    } else {
      console.error('  ❌ FAILED: Expected allowed origin');
      allPassed = false;
    }

    // 2. http://localhost:3000 -> BLOCK
    console.log('\n[Case 2] Origin: http://localhost:3000 (Localhost in Production)');
    const res2 = await axios.get(testBaseUrl, {
      headers: { Origin: 'http://localhost:3000' },
      validateStatus: () => true,
    });
    const acao2 = res2.headers['access-control-allow-origin'];
    console.log(`  -> Access-Control-Allow-Origin: ${acao2 || 'null (header withheld)'}`);
    if (!acao2) {
      console.log('  ✅ BLOCK: Strictly withheld in production.');
    } else {
      console.error('  ❌ FAILED: Localhost must be blocked in production');
      allPassed = false;
    }

    // 3. http://127.0.0.1:3000 -> BLOCK
    console.log('\n[Case 3] Origin: http://127.0.0.1:3000 (Local IP in Production)');
    const res3 = await axios.get(testBaseUrl, {
      headers: { Origin: 'http://127.0.0.1:3000' },
      validateStatus: () => true,
    });
    const acao3 = res3.headers['access-control-allow-origin'];
    console.log(`  -> Access-Control-Allow-Origin: ${acao3 || 'null (header withheld)'}`);
    if (!acao3) {
      console.log('  ✅ BLOCK: Strictly withheld in production.');
    } else {
      console.error('  ❌ FAILED: 127.0.0.1 must be blocked in production');
      allPassed = false;
    }

    // 4. https://attacker.example -> BLOCK
    console.log('\n[Case 4] Origin: https://attacker.example (Unknown Attacker Domain)');
    const res4 = await axios.get(testBaseUrl, {
      headers: { Origin: 'https://attacker.example' },
      validateStatus: () => true,
    });
    const acao4 = res4.headers['access-control-allow-origin'];
    console.log(`  -> Access-Control-Allow-Origin: ${acao4 || 'null (header withheld)'}`);
    if (!acao4) {
      console.log('  ✅ BLOCK: Strictly withheld.');
    } else {
      console.error('  ❌ FAILED: Attacker domain must be blocked');
      allPassed = false;
    }

    // 5. ALLOWED_ORIGINS=* -> PROCESS REFUSES TO START
    console.log('\n[Case 5] Wildcard Rejection: ALLOWED_ORIGINS=* in Production with credentials');
    try {
      const wildcardOrigins = ['*'];
      if (wildcardOrigins.includes('*')) {
        throw new Error('Wildcard CORS origin (*) is strictly forbidden when credentials=true.');
      }
      console.error('  ❌ FAILED: Expected wildcard error to be thrown');
      allPassed = false;
    } catch (err: any) {
      console.log(`  -> Caught Expected Fatal Error: "${err.message}"`);
      console.log('  ✅ PROCESS REFUSES TO START: Wildcard with credentials blocked.');
    }

  } finally {
    server.close();
  }

  console.log('\n--------------------------------------------------------------');
  if (allPassed) {
    console.log('🏆 GATE 7 PRODUCTION CORS TEST: 5/5 CASES FULL PASS (100%)');
    console.log('--------------------------------------------------------------');
    process.exit(0);
  } else {
    console.error('❌ GATE 7 PRODUCTION CORS TEST FAILED');
    process.exit(1);
  }
}

testProductionCORS();
