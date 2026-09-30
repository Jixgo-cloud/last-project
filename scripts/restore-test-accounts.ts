import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function restore() {
  const defaultHash = bcrypt.hashSync('password123', 10);
  const adminHash = bcrypt.hashSync('admin123', 10);

  await prisma.user.updateMany({
    where: { email: 'candidate@smartcareer.dev' },
    data: { isActive: true, passwordHash: defaultHash },
  });

  await prisma.user.updateMany({
    where: { email: 'hr@techcorp.co.th' },
    data: { isActive: true, passwordHash: defaultHash },
  });

  await prisma.user.updateMany({
    where: { email: 'admin@smartcareer.dev' },
    data: { isActive: true, passwordHash: adminHash },
  });

  console.log('✅ Test accounts restored for UAT regression run.');
  await prisma.$disconnect();
}

restore().catch(console.error);
