import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Password Policy Enforcement
function validatePasswordPolicy(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 12) {
    return { valid: false, reason: 'Password must be at least 12 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one number (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      valid: false,
      reason: 'Password must contain at least one special character (e.g. !@#$%^&*).',
    };
  }

  const blacklisted = [
    'admin123',
    'admin1234',
    'password123',
    'password1234',
    'smartcareer',
    'administrator',
    'smartcareer2026',
  ];
  if (blacklisted.some((b) => password.toLowerCase().includes(b))) {
    return {
      valid: false,
      reason: 'Password contains common dictionary or project terms that are blacklisted.',
    };
  }

  return { valid: true };
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || process.argv[2] || '').trim();
  const password = (process.env.ADMIN_PASSWORD || process.argv[3] || '').trim();

  if (!email || !password) {
    console.error('❌ Error: Both ADMIN_EMAIL and ADMIN_PASSWORD must be provided.');
    console.error('Usage via env: ADMIN_EMAIL="admin@yourdomain.com" ADMIN_PASSWORD="..." npx ts-node scripts/create-superadmin.ts');
    process.exit(1);
  }

  // 1. Validate Email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('❌ Error: Invalid email address format.');
    process.exit(1);
  }

  // 2. Validate Password Policy
  const policyCheck = validatePasswordPolicy(password);
  if (!policyCheck.valid) {
    console.error(`❌ Security Policy Violation: ${policyCheck.reason}`);
    process.exit(1);
  }

  // 3. Duplicate check - refuse to overwrite
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.error(`❌ Refusing to run: User with email "${email}" already exists. Duplicate admin creation rejected.`);
    process.exit(1);
  }

  // 4. Hash password with bcrypt 12 salt rounds
  const passwordHash = await bcrypt.hash(password, 12);

  // 5. Create Admin user
  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  // Note: Password is NEVER printed or logged to stdout
  console.log(`✅ Superadmin successfully provisioned:`);
  console.log(`   - User ID: ${admin.id}`);
  console.log(`   - Email: ${admin.email}`);
  console.log(`   - Role: ${admin.role}`);
  console.log(`   - Password Hash: bcrypt (12 rounds)`);
  console.log(`🎉 Superadmin bootstrap complete.`);
}

main()
  .catch((e) => {
    console.error('❌ Superadmin provisioning failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
