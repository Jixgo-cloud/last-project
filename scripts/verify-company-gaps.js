const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyCompanyGaps() {
  console.log('======================================================================');
  console.log('🧪 Verifying Company Scope Gaps (GAP-COM-01 & GAP-COM-02)');
  console.log('======================================================================');

  try {
    // 1. Get Company Token
    console.log('\n[1] Authenticating as Company (hr@techcorp.co.th)...');
    const authRes = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'hr@techcorp.co.th', password: 'password123' })
    });
    const authData = await authRes.json();
    if (!authData.token) {
      throw new Error('Authentication failed: ' + JSON.stringify(authData));
    }
    const token = authData.token;
    console.log('   ✅ Company authenticated successfully!');

    // ----------------------------------------------------
    // [GAP-COM-01] TC-COM-05: Job Quota Auto-Close Verification
    // ----------------------------------------------------
    console.log('\n[2] Testing GAP-COM-01 (TC-COM-05): Job Quota Auto-Close...');

    // 2.1 Create a test job with acceptedQuota = 1
    const createJobRes = await fetch('http://localhost:4000/api/company/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Quota Auto-Close Test Engineer ' + Date.now(),
        location: 'Bangkok, Thailand',
        isRemote: true,
        employmentType: 'FULL_TIME',
        salaryMin: 70000,
        salaryMax: 120000,
        acceptedQuota: 1, // Quota of 1 accepted candidate
        description: 'Testing quota auto-close logic',
        requirements: 'Auto-close test requirements',
        skills: []
      })
    });
    const jobData = await createJobRes.json();
    console.log(`   - Created test job with acceptedQuota: ${jobData.acceptedQuota}, isActive: ${jobData.isActive}, ID: ${jobData.id}`);

    if (jobData.acceptedQuota !== 1 || !jobData.isActive) {
      throw new Error(`Job creation did not properly store acceptedQuota=1 or isActive=true`);
    }

    // 2.2 Get a candidate to apply for this job
    const candidate = await prisma.candidateProfile.findFirst({
      include: { user: true }
    });
    if (!candidate) throw new Error('No candidate found in database');

    const appRecord = await prisma.jobApplication.create({
      data: {
        jobId: jobData.id,
        candidateId: candidate.id,
        status: 'REVIEWING',
        roundNumber: 1,
        matchScoreAtApplication: 88
      }
    });
    console.log(`   - Candidate ${candidate.fullName} applied, Application ID: ${appRecord.id}, Status: REVIEWING`);

    // Verify job is still active
    let currentJob = await prisma.job.findUnique({ where: { id: jobData.id } });
    console.log(`   - Current Job isActive before accept: ${currentJob.isActive}`);

    // 2.3 Accept candidate through Company API endpoint (PUT /company/applications/:id/status)
    const updateRes = await fetch(`http://localhost:4000/api/company/applications/${appRecord.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        status: 'ACCEPTED',
        note: 'Accepted test candidate for quota auto-close verification'
      })
    });
    const updatedAppData = await updateRes.json();
    console.log(`   - Updated application status: ${updatedAppData.status}`);

    // 2.4 Check if job was automatically closed (isActive = false)
    currentJob = await prisma.job.findUnique({ where: { id: jobData.id } });
    console.log(`   - Job isActive after reaching acceptedQuota (1/1): ${currentJob.isActive}`);

    if (currentJob.isActive === false) {
      console.log('   🎉 [GAP-COM-01 / TC-COM-05] SUCCESS: Job was automatically closed when acceptedQuota was reached!');
    } else {
      throw new Error('FAIL: Job was NOT automatically closed after acceptedQuota reached!');
    }

    // Clean up test job and application
    await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: appRecord.id } });
    await prisma.jobApplication.delete({ where: { id: appRecord.id } });
    await prisma.job.delete({ where: { id: jobData.id } });
    console.log('   - Cleaned up test records.');

    // ----------------------------------------------------
    // [GAP-COM-02] TC-COM-13: Applicant Batch Data Export (CSV Export)
    // ----------------------------------------------------
    console.log('\n[3] Testing GAP-COM-02 (TC-COM-13): CSV Export Endpoint...');
    const exportRes = await fetch('http://localhost:4000/api/company/applications/export', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const contentType = exportRes.headers.get('content-type') || '';
    const contentDisposition = exportRes.headers.get('content-disposition') || '';
    const buffer = Buffer.from(await exportRes.arrayBuffer());
    const hasUtf8Bom = buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
    const csvText = buffer.toString('utf-8');

    console.log(`   - HTTP Status: ${exportRes.status}`);
    console.log(`   - Content-Type: ${contentType}`);
    console.log(`   - Content-Disposition: ${contentDisposition}`);
    console.log(`   - Raw bytes [0..2]: [${buffer[0].toString(16)}, ${buffer[1].toString(16)}, ${buffer[2].toString(16)}]`);
    console.log(`   - Starts with UTF-8 BOM (0xEF 0xBB 0xBF): ${hasUtf8Bom ? 'YES' : 'NO'}`);
    console.log(`   - First line (Header): ${csvText.split('\r\n')[0]}`);
    console.log(`   - Total lines in CSV: ${csvText.split('\r\n').length}`);

    if (
      exportRes.status === 200 &&
      contentType.includes('text/csv') &&
      csvText.includes('Application ID') &&
      csvText.includes('Candidate Name') &&
      hasUtf8Bom
    ) {
      console.log('   🎉 [GAP-COM-02 / TC-COM-13] SUCCESS: CSV export endpoint returned valid formatted CSV with UTF-8 BOM!');
    } else {
      throw new Error('FAIL: CSV export response did not meet specifications!');
    }

    console.log('\n======================================================================');
    console.log('✅ ALL COMPANY SCOPE GAPS VERIFIED SUCCESSFULLY (2/2 PASS)');
    console.log('======================================================================');

  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCompanyGaps();
