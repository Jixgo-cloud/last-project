const https = require('https');

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('====================================================');
  console.log('🧪 VERIFYING DEPLOYED SYSTEM: WEB & API AUDIT');
  console.log('====================================================\n');

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition, message) {
    totalChecks++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passedChecks++;
    } else {
      console.log(`❌ [FAIL] ${message}`);
    }
  }

  // 1. Backend Health & Database Check
  console.log('--- 1. Testing Railway API Service Health ---');
  try {
    const health = await request('https://smartcareerapi-production.up.railway.app/api/health');
    assert(health.statusCode === 200, `API Health status is 200 (Got ${health.statusCode})`);
    const healthJson = JSON.parse(health.body);
    assert(healthJson.status === 'ok', `API Health status is "ok"`);
    assert(healthJson.database === 'connected', `Database connection status is "connected"`);
  } catch (err) {
    assert(false, `API Health Check failed: ${err.message}`);
  }

  // 2. CORS Preflight & Headers
  console.log('\n--- 2. Testing CORS between Vercel and Railway ---');
  try {
    const corsPreflight = await request('https://smartcareerapi-production.up.railway.app/api/jobs', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://smartcareerplatform.vercel.app',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    });
    assert(corsPreflight.statusCode === 204, `CORS Preflight status is 204 No Content (Got ${corsPreflight.statusCode})`);
    assert(
      corsPreflight.headers['access-control-allow-origin'] === 'https://smartcareerplatform.vercel.app',
      `Access-Control-Allow-Origin header matches frontend domain (Got: ${corsPreflight.headers['access-control-allow-origin']})`
    );
    assert(
      corsPreflight.headers['access-control-allow-credentials'] === 'true',
      `Access-Control-Allow-Credentials is true`
    );
  } catch (err) {
    assert(false, `CORS Preflight Check failed: ${err.message}`);
  }

  // 3. API Jobs Data Check
  console.log('\n--- 3. Testing API Data Delivery (/api/jobs) ---');
  try {
    const jobsRes = await request('https://smartcareerapi-production.up.railway.app/api/jobs', {
      headers: {
        'Origin': 'https://smartcareerplatform.vercel.app'
      }
    });
    assert(jobsRes.statusCode === 200, `Jobs endpoint returned status 200`);
    const jobsData = JSON.parse(jobsRes.body);
    const jobsList = Array.isArray(jobsData) ? jobsData : (jobsData.data || jobsData.jobs || []);
    assert(jobsList.length > 0, `Jobs list is not empty (Found ${jobsList.length} jobs)`);
    if (jobsList.length > 0) {
      console.log(`   Sample Job: "${jobsList[0].title}" at "${jobsList[0].company?.name || jobsList[0].companyName || 'N/A'}"`);
    }
  } catch (err) {
    assert(false, `Jobs API failed: ${err.message}`);
  }

  // 4. API Skills Data Check
  console.log('\n--- 4. Testing API Data Delivery (/api/skills) ---');
  try {
    const skillsRes = await request('https://smartcareerapi-production.up.railway.app/api/skills');
    assert(skillsRes.statusCode === 200, `Skills endpoint returned status 200`);
    const skillsList = JSON.parse(skillsRes.body);
    assert(Array.isArray(skillsList) && skillsList.length > 0, `Skills list has items (Found ${skillsList.length} skills)`);
  } catch (err) {
    assert(false, `Skills API failed: ${err.message}`);
  }

  // 5. Test Authentication on Production API
  console.log('\n--- 5. Testing API Authentication (/api/auth/register & /api/auth/login) ---');
  try {
    const testEmail = 'verify_flow_' + Date.now() + '@smartcareer.test';
    const regRes = await request('https://smartcareerapi-production.up.railway.app/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://smartcareerplatform.vercel.app'
      },
      body: {
        email: testEmail,
        password: 'Password123!',
        role: 'CANDIDATE',
        fullName: 'Deploy Tester'
      }
    });
    assert(regRes.statusCode === 201, `Candidate registration successful (HTTP 201)`);
    const regData = JSON.parse(regRes.body);
    assert(!!regData.token, `Registration returned JWT token`);

    const loginRes = await request('https://smartcareerapi-production.up.railway.app/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://smartcareerplatform.vercel.app'
      },
      body: {
        email: testEmail,
        password: 'Password123!'
      }
    });
    assert(loginRes.statusCode === 200 || loginRes.statusCode === 201, `Candidate login successful (HTTP ${loginRes.statusCode})`);
    const loginData = JSON.parse(loginRes.body);
    assert(!!loginData.token, `Login returned valid JWT token`);
  } catch (err) {
    assert(false, `Auth flow failed: ${err.message}`);
  }

  // 6. Test Frontend (Vercel) Deployment
  console.log('\n--- 6. Testing Frontend Deployment (https://smartcareerplatform.vercel.app) ---');
  let frontendHtml = '';
  try {
    const fe = await request('https://smartcareerplatform.vercel.app');
    assert(fe.statusCode === 200, `Frontend root returned 200 OK`);
    frontendHtml = fe.body;
    assert(frontendHtml.includes('SmartCareer'), `Frontend HTML contains brand "SmartCareer"`);
  } catch (err) {
    assert(false, `Frontend fetch failed: ${err.message}`);
  }

  // 7. Check Frontend JS Bundles for API URL Configuration
  console.log('\n--- 7. Inspecting Frontend JS Bundles for API Endpoint Configuration ---');
  try {
    const scriptSrcs = [];
    const scriptMatches = frontendHtml.match(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g) || [];
    for (const m of scriptMatches) {
      const src = m.match(/src="([^"]+)"/)[1];
      scriptSrcs.push(src);
    }
    console.log(`   Found ${scriptSrcs.length} client chunk scripts in frontend HTML.`);

    let railwayFound = false;
    let localhostFound = false;
    for (const src of scriptSrcs) {
      const scriptRes = await request(`https://smartcareerplatform.vercel.app${src}`);
      if (scriptRes.body.includes('smartcareerapi-production.up.railway.app')) {
        railwayFound = true;
        console.log(`   🎯 Verified: Chunk "${src.split('/').pop()}" points to Railway production API!`);
      }
      if (scriptRes.body.includes('localhost:4000')) {
        localhostFound = true;
      }
    }

    assert(railwayFound, `Frontend client bundle is compiled with Railway Production API URL (NEXT_PUBLIC_API_URL)`);
    if (localhostFound) {
      console.log(`   ℹ️ Note: Fallback 'localhost:4000' default code string detected in bundle (normal for JS ternary/fallback).`);
    }
  } catch (err) {
    assert(false, `Frontend bundle inspection failed: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`📊 SUMMARY: ${passedChecks}/${totalChecks} Checks Passed (${Math.round(passedChecks/totalChecks*100)}%)`);
  console.log('====================================================');
}

runAudit().catch(console.error);
