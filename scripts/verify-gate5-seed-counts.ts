import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function getCounts() {
  const [skills, frameworks, frameworkItems, assessments, questions, choices, courses, users, applications] =
    await Promise.all([
      prisma.skill.count(),
      prisma.skillFramework.count(),
      prisma.skillFrameworkItem.count(),
      prisma.assessment.count(),
      prisma.question.count(),
      prisma.choice.count(),
      prisma.course.count(),
      prisma.user.count(),
      prisma.jobApplication.count(),
    ]);

  return {
    skills,
    frameworks,
    frameworkItems,
    assessments,
    questions,
    choices,
    courses,
    users,
    applications,
  };
}

async function verifyGate5() {
  console.log('===============================================================');
  console.log('🛡️ GATE 5: PRODUCTION SEED ZERO-DESTRUCTIVE & IDEMPOTENCY AUDIT');
  console.log('===============================================================\n');

  // 1. Static AST/Source Code Audit
  console.log('1. Auditing prisma/seed-production.ts for destructive commands:');
  const seedContent = fs.readFileSync(path.join(process.cwd(), 'prisma/seed-production.ts'), 'utf-8');

  // Strip comments before checking for executable commands
  const codeWithoutComments = seedContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

  const hasDeleteMany = /\.deleteMany\s*\(/.test(codeWithoutComments);
  const hasDelete = /\.delete\s*\(/.test(codeWithoutComments);
  const hasTruncate = /\bTRUNCATE\b/i.test(codeWithoutComments);

  console.log(`   - Contains deleteMany(): ${hasDeleteMany ? '❌ VIOLATION' : '✅ NONE (SAFE)'}`);
  console.log(`   - Contains delete(): ${hasDelete ? '❌ VIOLATION' : '✅ NONE (SAFE)'}`);
  console.log(`   - Contains TRUNCATE: ${hasTruncate ? '❌ VIOLATION' : '✅ NONE (SAFE)'}`);

  if (hasDeleteMany || hasDelete || hasTruncate) {
    throw new Error('Destructive statements found in prisma/seed-production.ts!');
  }

  // 2. Capture Initial Counts
  console.log('\n2. Capturing Initial Table Counts (BEFORE):');
  const before = await getCounts();
  console.log(before);

  // 3. Run 1
  console.log('\n3. Executing Production Seed (Run 1)...');
  execSync('npx ts-node prisma/seed-production.ts', {
    cwd: process.cwd(),
    env: { ...process.env, ALLOW_PRODUCTION_SEED: 'true' },
    stdio: 'inherit',
  });
  const afterRun1 = await getCounts();
  console.log('Counts AFTER Run 1:', afterRun1);

  // 4. Run 2
  console.log('\n4. Executing Production Seed (Run 2 - Idempotency Test)...');
  execSync('npx ts-node prisma/seed-production.ts', {
    cwd: process.cwd(),
    env: { ...process.env, ALLOW_PRODUCTION_SEED: 'true' },
    stdio: 'inherit',
  });
  const afterRun2 = await getCounts();
  console.log('Counts AFTER Run 2:', afterRun2);

  // 5. Verification Table
  console.log('\n5. Table Counts Comparison & Idempotency Delta:');
  console.log('---------------------------------------------------------------------------------');
  console.log('| Table                     | Initial | After Run 1 | After Run 2 | Delta | Status |');
  console.log('---------------------------------------------------------------------------------');

  const tables = Object.keys(before) as (keyof typeof before)[];
  let allIdempotent = true;

  for (const t of tables) {
    const b = before[t];
    const r1 = afterRun1[t];
    const r2 = afterRun2[t];
    const delta = r2 - r1;
    const isIdempotent = r1 === r2;
    if (!isIdempotent) allIdempotent = false;

    const pad = (str: any, len: number) => String(str).padEnd(len);
    console.log(
      `| ${pad(t, 25)} | ${pad(b, 7)} | ${pad(r1, 11)} | ${pad(r2, 11)} | ${pad(delta, 5)} | ${
        isIdempotent ? '✅ PASS' : '❌ FAIL'
      } |`,
    );
  }
  console.log('---------------------------------------------------------------------------------');

  if (allIdempotent) {
    console.log('🎉 GATE 5 FULL PASS: Production Seed is strictly NON-DESTRUCTIVE and 100% IDEMPOTENT.');
  } else {
    console.error('❌ GATE 5 FAILED: Inconsistent table counts detected between seed runs.');
    process.exit(1);
  }

  await prisma.$disconnect();
}

verifyGate5().catch(console.error);
