const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    }).on('error', reject);
  });
}

async function checkLive() {
  console.log('--- 1. Testing Frontend (https://smartcareerplatform.vercel.app) ---');
  try {
    const fe = await get('https://smartcareerplatform.vercel.app');
    console.log('Frontend Status:', fe.status);
    console.log('Frontend Content-Length:', fe.data.length);
    console.log('Has Landing content:', fe.data.includes('SmartCareer'));
  } catch (err) {
    console.error('Frontend error:', err.message);
  }

  console.log('\n--- 2. Testing Backend Health (Railway) ---');
  try {
    const be = await get('https://smartcareerapi-production.up.railway.app/api/health');
    console.log('Backend Status:', be.status);
    console.log('Backend Response:', be.data);
  } catch (err) {
    console.error('Backend error:', err.message);
  }

  console.log('\n--- 3. Testing Public Jobs API ---');
  try {
    const jobs = await get('https://smartcareerapi-production.up.railway.app/api/jobs');
    console.log('Jobs API Status:', jobs.status);
    const parsed = JSON.parse(jobs.data);
    console.log('Total jobs returned:', Array.isArray(parsed) ? parsed.length : (parsed.data ? parsed.data.length : 'Object'));
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log('Sample Job Title:', parsed[0].title, '| Company:', parsed[0].companyName || parsed[0].company?.name);
    }
  } catch (err) {
    console.error('Jobs API error:', err.message);
  }

  console.log('\n--- 4. Testing Public Skills API ---');
  try {
    const skills = await get('https://smartcareerapi-production.up.railway.app/api/skills');
    console.log('Skills API Status:', skills.status);
    const parsed = JSON.parse(skills.data);
    console.log('Total skills returned:', Array.isArray(parsed) ? parsed.length : 'Object');
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log('Sample Skills:', parsed.slice(0, 5).map(s => s.name).join(', '));
    }
  } catch (err) {
    console.error('Skills API error:', err.message);
  }
}

checkLive();
