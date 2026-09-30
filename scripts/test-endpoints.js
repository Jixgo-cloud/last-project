const http = require('http');

async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:4000');
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- 1. Testing Auth Logins ---');
  // Candidate
  const candLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'candidate@smartcareer.dev', password: 'password123' },
  });
  console.log('Candidate login:', candLogin.status, candLogin.data?.role, candLogin.data?.user?.fullName);

  // Company
  const compLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'hr@techcorp.co.th', password: 'password123' },
  });
  console.log('Company login:', compLogin.status, compLogin.data?.role, compLogin.data?.company?.name);

  // Admin
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@smartcareer.dev', password: 'admin123' },
  });
  console.log('Admin login:', adminLogin.status, adminLogin.data?.role);

  console.log('\n--- 2. Public Endpoints ---');
  const jobsRes = await request('/api/jobs?limit=3');
  console.log('Jobs count returned:', jobsRes.data?.data?.length, 'total:', jobsRes.data?.total);

  const assessRes = await request('/api/assessments');
  console.log('Assessments count:', assessRes.data?.length);

  const coursesRes = await request('/api/recommendations/courses');
  console.log('Courses count:', coursesRes.data?.length);

  console.log('\n--- 3. Candidate Endpoints ---');
  const candToken = candLogin.data?.token;
  const candProfile = await request('/api/candidate/profile', {
    headers: { Authorization: `Bearer ${candToken}` },
  });
  console.log('Candidate profile skills:', candProfile.data?.skills?.length, 'repos:', candProfile.data?.githubRepos?.length);

  const radarRes = await request('/api/candidate/radar', {
    headers: { Authorization: `Bearer ${candToken}` },
  });
  console.log('Candidate radar points:', radarRes.data?.length);

  const candGaps = await request('/api/recommendations/skill-gaps', {
    headers: { Authorization: `Bearer ${candToken}` },
  });
  console.log('Candidate skill gaps:', candGaps.data?.gaps?.length, 'recommendations:', candGaps.data?.recommendedCourses?.length);

  console.log('\n--- 4. Company Endpoints ---');
  const compToken = compLogin.data?.token;
  const compProfile = await request('/api/company/profile', {
    headers: { Authorization: `Bearer ${compToken}` },
  });
  console.log('Company profile name:', compProfile.data?.name, 'verification:', compProfile.data?.verificationStatus);

  const compApps = await request('/api/company/applications', {
    headers: { Authorization: `Bearer ${compToken}` },
  });
  console.log('Company applications:', compApps.data?.length);

  console.log('\n--- 5. Admin Endpoints ---');
  const adminToken = adminLogin.data?.token;
  const adminDash = await request('/api/admin/dashboard', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('Admin dashboard stats:', adminDash.data);

  const adminVerifs = await request('/api/admin/verifications', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('Admin verifications pending/total:', adminVerifs.data?.length);

  console.log('\n--- 6. Coding Assessment Execution ---');
  // Find a coding assessment
  const codingAssessment = assessRes.data?.find(a => a.type === 'PRACTICAL_CODING');
  if (codingAssessment) {
    console.log('Found coding assessment:', codingAssessment.title, codingAssessment.id);
    const startRes = await request(`/api/assessments/${codingAssessment.id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${candToken}` },
    });
    console.log('Start attempt status:', startRes.status, 'attemptId:', startRes.data?.id);
    const detailRes = await request(`/api/assessments/${codingAssessment.id}`, {
      headers: { Authorization: `Bearer ${candToken}` },
    });
    const question = detailRes.data?.questions?.[0];
    if (question) {
      console.log('Testing code run for question:', question.title, question.id);
      const runRes = await request(`/api/assessments/${codingAssessment.id}/run-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${candToken}` },
        body: {
          questionId: question.id,
          sourceCode: question.starterCode || 'function twoSum(nums, target) { return [0, 1]; }',
        },
      });
      console.log('Code run result status:', runRes.status, 'data:', runRes.data);
    } else {
      console.log('No questions found in assessment detail');
    }
  } else {
    console.log('No coding assessment found.');
  }

  process.exit(0);
}

runTests().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});
