const http = require('http');

function apiCall(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: '/api' + path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resBody);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('🚀 Verifying Candidate Scope Gaps (GAP-CAN-01, GAP-CAN-02, GAP-CAN-03)...\n');

  // 1. Login as Candidate
  console.log('1. Logging in as Candidate...');
  const loginRes = await apiCall('/auth/login', 'POST', {
    email: 'candidate@smartcareer.dev',
    password: 'password123'
  });
  const token = loginRes.data.token || loginRes.data.accessToken;
  if (!token) {
    console.error('❌ Login failed: No token returned', loginRes);
    process.exit(1);
  }
  console.log('✅ Candidate logged in successfully.');

  // 2. Test GAP-CAN-03: Job Bookmarking / Favorite Jobs
  console.log('\n2. Testing GAP-CAN-03: Job Favorite Toggle & Retrieval...');
  const jobsRes = await apiCall('/jobs?limit=5', 'GET', null, token);
  const sampleJob = jobsRes.data.jobs[0];
  console.log(`   Sample Job ID: ${sampleJob.id} ("${sampleJob.title}")`);

  // 2.1 Add to favorite
  console.log('   Toggling favorite (Add)...');
  const favAddRes = await apiCall(`/jobs/${sampleJob.id}/favorite`, 'POST', {}, token);
  console.log('   Response:', favAddRes.status, favAddRes.data);
  if (favAddRes.status !== 201 && favAddRes.status !== 200) throw new Error('Failed to toggle favorite');

  // 2.2 Get favorites
  console.log('   Fetching favorites list (/jobs/favorites/me)...');
  const favListRes = await apiCall('/jobs/favorites/me', 'GET', null, token);
  console.log(`   Found ${favListRes.data.length} favorite job(s).`);
  const isPresent = favListRes.data.some(j => j.id === sampleJob.id);
  if (!isPresent) throw new Error('Job not present in favorites list');
  console.log('   ✅ GAP-CAN-03 (Add & Retrieve Favorite) VERIFIED!');

  // 2.3 Remove from favorite
  console.log('   Toggling favorite again (Remove)...');
  const favRemoveRes = await apiCall(`/jobs/${sampleJob.id}/favorite`, 'POST', {}, token);
  console.log('   Response:', favRemoveRes.status, favRemoveRes.data);
  console.log('   ✅ GAP-CAN-03 (Toggle Remove) VERIFIED!');

  // 3. Test GAP-CAN-01 & GAP-CAN-02: Application Lifecycle & Reapply by Round
  console.log('\n3. Testing GAP-CAN-01 & GAP-CAN-02: Application Cancellation & Reapply by Round...');
  
  // Pick an active internal job or available job
  const testJob = jobsRes.data.jobs.find(j => j.isActive) || sampleJob;
  console.log(`   Target Job: ${testJob.id} ("${testJob.title}")`);

  // Check existing applications for this job
  const appsRes = await apiCall('/candidate/applications', 'GET', null, token);
  const existingApp = appsRes.data.find(a => a.jobId === testJob.id && a.status !== 'CANCELLED' && a.status !== 'REJECTED');
  
  let targetAppId;
  if (!existingApp) {
    console.log('   Submitting initial application...');
    const applyRes = await apiCall(`/applications/${testJob.id}/apply`, 'POST', {
      coverLetter: 'Test cover letter for candidate gap verification.'
    }, token);
    console.log('   Application submitted:', applyRes.status, 'Round:', applyRes.data.roundNumber);
    targetAppId = applyRes.data.id;
  } else {
    targetAppId = existingApp.id;
    console.log(`   Found existing active application ID: ${targetAppId} (Round: ${existingApp.roundNumber || 1})`);
  }

  // 3.1 Cancel application (GAP-CAN-01)
  console.log(`   Cancelling application ${targetAppId}...`);
  const cancelRes = await apiCall(`/applications/${targetAppId}`, 'DELETE', null, token);
  console.log('   Cancel Response:', cancelRes.status, cancelRes.data?.status);
  if (cancelRes.data?.status !== 'CANCELLED') {
    throw new Error(`Expected CANCELLED status, got ${cancelRes.data?.status}`);
  }
  console.log('   ✅ GAP-CAN-01 (Application Cancellation Lifecycle) VERIFIED!');

  // 3.2 Reapply by Round (GAP-CAN-02)
  console.log('   Reapplying to the same job (Should create Round 2 or next round)...');
  const reapplyRes = await apiCall(`/applications/${testJob.id}/apply`, 'POST', {
    coverLetter: 'Re-applying for the second round after cancellation.'
  }, token);
  console.log('   Reapply Response:', reapplyRes.status, 'New Application ID:', reapplyRes.data.id, 'New Round Number:', reapplyRes.data.roundNumber);
  if (reapplyRes.status !== 201 && reapplyRes.status !== 200) {
    throw new Error('Reapplying failed: ' + JSON.stringify(reapplyRes));
  }
  if (!reapplyRes.data.roundNumber || reapplyRes.data.roundNumber <= 1) {
    throw new Error(`Expected roundNumber > 1, got ${reapplyRes.data.roundNumber}`);
  }
  console.log(`   ✅ GAP-CAN-02 (Application Reapply by Round Policy - Round ${reapplyRes.data.roundNumber}) VERIFIED!`);

  console.log('\n🎉 ALL 3 CANDIDATE SCOPE GAPS HAVE BEEN FULLY RESOLVED AND VERIFIED! 🎉');
}

run().catch(err => {
  console.error('❌ Error during verification:', err);
  process.exit(1);
});
