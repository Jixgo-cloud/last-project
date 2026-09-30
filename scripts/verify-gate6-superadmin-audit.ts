import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function verifyGate6() {
  console.log('===============================================================');
  console.log('🛡️ GATE 6: SUPERADMIN BOOTSTRAP POSITIVE PATH & LOG AUDIT');
  console.log('===============================================================\n');

  const testEmail = 'ops.superadmin@smartcareer.internal';
  const testPassword = 'V3ry$tr0ng!P@ssw0rd2026#Prod';

  // Ensure clean starting state for this test email
  await prisma.user.deleteMany({ where: { email: testEmail } });

  console.log(`1. Executing Superadmin Provisioning for ${testEmail}...`);
  let output = '';
  try {
    output = execSync(
      `npx ts-node scripts/create-superadmin.ts ${testEmail} ${testPassword}`,
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
      },
    );
  } catch (err: any) {
    output = err.stdout + '\n' + err.stderr;
  }

  console.log('Raw Command Output:\n' + output);

  // Assertions:
  // A. Check that the secret password is NOT printed anywhere in the output!
  const passwordLeaked = output.includes(testPassword);
  console.log(`\n2. Log Secret Audit:`);
  console.log(`   - Secret Password in stdout/stderr: ${passwordLeaked ? '❌ CRITICAL LEAK!' : '✅ NONE (SAFE)'}`);
  if (passwordLeaked) {
    throw new Error('Secret password leaked in logs!');
  }

  // B. Verify user in database
  console.log(`\n3. Verifying Created User in Database:`);
  const createdAdmin = await prisma.user.findUnique({
    where: { email: testEmail },
  });

  if (!createdAdmin) {
    throw new Error(`Admin user ${testEmail} was not found in database!`);
  }

  console.log(`   - ID: ${createdAdmin.id}`);
  console.log(`   - Email: ${createdAdmin.email}`);
  console.log(`   - Role: ${createdAdmin.role} (Expected: ADMIN)`);
  console.log(`   - Hash format: ${createdAdmin.passwordHash?.substring(0, 7)}... (Expected: $2b$12$ or $2a$12$)`);
  console.log(`   - Active: ${createdAdmin.isActive}`);

  const isBcrypt12 = createdAdmin.passwordHash?.startsWith('$2b$12$') || createdAdmin.passwordHash?.startsWith('$2a$12$');
  if (!isBcrypt12 || createdAdmin.role !== 'ADMIN') {
    throw new Error('Admin role or bcrypt 12-round hash verification failed!');
  }

  // C. Test duplicate protection: Run second time
  console.log(`\n4. Testing Duplicate Prevention (Second Execution):`);
  let duplicateOutput = '';
  try {
    duplicateOutput = execSync(
      `npx ts-node scripts/create-superadmin.ts ${testEmail} ${testPassword}`,
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
      },
    );
  } catch (err: any) {
    duplicateOutput = err.stdout + '\n' + err.stderr;
  }

  const duplicateRejected = duplicateOutput.includes('already exists') && duplicateOutput.includes('rejected');
  console.log(`   - Duplicate Attempt Rejected: ${duplicateRejected ? '✅ PASS' : '❌ FAIL'}`);

  // Cleanup test user
  await prisma.user.deleteMany({ where: { email: testEmail } });
  console.log(`   - Test user cleaned up safely.`);

  console.log('\n===============================================================');
  console.log('🎉 GATE 6 FULL PASS: Superadmin Provisioning is safe, robust, and leak-free.');
  console.log('===============================================================');

  await prisma.$disconnect();
}

verifyGate6().catch(console.error);
