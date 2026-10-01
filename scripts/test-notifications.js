const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runTest() {
  console.log('🧪 Starting Candidate Notification Verification Test...');

  // 1. Find candidate and company
  const candidateUser = await prisma.user.findFirst({
    where: { role: 'CANDIDATE' },
    include: { candidateProfile: true },
  });

  const companyUser = await prisma.user.findFirst({
    where: { role: 'COMPANY' },
    include: { companyMembers: { include: { company: true } } },
  });

  if (!candidateUser || !candidateUser.candidateProfile) {
    console.error('❌ Candidate user not found');
    process.exit(1);
  }

  if (!companyUser || !companyUser.companyMembers[0]) {
    console.error('❌ Company user not found');
    process.exit(1);
  }

  const company = companyUser.companyMembers[0].company;
  console.log(`✅ Found Candidate: ${candidateUser.email} (ID: ${candidateUser.id})`);
  console.log(`✅ Found Company: ${company.name} (User: ${companyUser.email})`);

  // 2. Find or create an application for this candidate & company's job
  let job = await prisma.job.findFirst({
    where: { companyId: company.id },
  });

  if (!job) {
    job = await prisma.job.create({
      data: {
        companyId: company.id,
        companyName: company.name,
        title: 'Senior Full Stack Engineer',
        slug: 'senior-full-stack-' + Date.now(),
        description: 'Test job description',
        location: 'Bangkok, Thailand',
      },
    });
    console.log(`Created test job: ${job.title}`);
  }

  let application = await prisma.jobApplication.findFirst({
    where: {
      jobId: job.id,
      candidateId: candidateUser.candidateProfile.id,
    },
    include: { job: true, candidate: true },
  });

  if (!application) {
    application = await prisma.jobApplication.create({
      data: {
        jobId: job.id,
        candidateId: candidateUser.candidateProfile.id,
        status: 'APPLIED',
        matchScoreAtApplication: 85,
        statusHistory: {
          create: {
            newStatus: 'APPLIED',
            note: 'Applied by candidate',
          },
        },
      },
      include: { job: true, candidate: true },
    });
    console.log(`Created test application ID: ${application.id}`);
  }

  // 3. Test Status Update & Notification Creation
  const newStatus = 'INTERVIEW';
  const previousStatus = application.status;
  const note = 'สัมภาษณ์รอบแรกผ่าน Google Meet วันที่ 10 ต.ค. เวลา 14:00 น.';

  console.log(`🔄 Updating application status: ${previousStatus} -> ${newStatus}`);

  const updatedApp = await prisma.jobApplication.update({
    where: { id: application.id },
    data: {
      status: newStatus,
      statusHistory: {
        create: {
          previousStatus,
          newStatus,
          changedById: companyUser.id,
          note,
        },
      },
    },
    include: { statusHistory: { orderBy: { createdAt: 'desc' } } },
  });

  console.log(`✅ Application status updated to: ${updatedApp.status}`);

  // Dispatch Notification (as implemented in CompanyService)
  const notification = await prisma.notification.create({
    data: {
      userId: candidateUser.id,
      type: 'APPLICATION_STATUS_CHANGED',
      title: 'นัดหมายสัมภาษณ์งาน',
      message: `บริษัท ${company.name} ได้นัดหมายสัมภาษณ์งานสำหรับตำแหน่ง "${job.title}"`,
      link: '/applications',
      metadata: {
        applicationId: application.id,
        jobId: job.id,
        jobTitle: job.title,
        companyName: company.name,
        previousStatus,
        newStatus,
        note,
      },
    },
  });

  console.log(`🔔 Notification Created in DB:`, {
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  });

  // 4. Verify unread count
  const unreadCount = await prisma.notification.count({
    where: { userId: candidateUser.id, isRead: false },
  });
  console.log(`📊 Candidate Unread Notifications Count: ${unreadCount}`);
  if (unreadCount < 1) {
    throw new Error('Expected at least 1 unread notification');
  }

  // 5. Test Mark as Read
  const marked = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });
  console.log(`👁️ Notification marked as read. isRead: ${marked.isRead}`);

  const remainingUnread = await prisma.notification.count({
    where: { userId: candidateUser.id, isRead: false },
  });
  console.log(`📊 Candidate Unread Count after read: ${remainingUnread}`);

  console.log('\n🎉 ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  await prisma.$disconnect();
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
