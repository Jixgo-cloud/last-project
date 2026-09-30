import {
  PrismaClient,
  SkillCategory,
  AssessmentType,
  QuestionDifficulty,
  CourseSource,
} from '@prisma/client';

const prisma = new PrismaClient();

// 1. Strict Refuse-to-Run Guards
if (!process.env.DATABASE_URL) {
  console.error('❌ Refusing to run: DATABASE_URL is not defined in environment.');
  process.exit(1);
}

if (process.env.ALLOW_PRODUCTION_SEED !== 'true') {
  console.error(
    '❌ Refusing to run production seed: Explicit confirmation required. Set ALLOW_PRODUCTION_SEED=true in environment.',
  );
  process.exit(1);
}

async function main() {
  console.log('🚀 Running Production Non-Destructive Master Seeding...');

  // Note: NO deleteMany(), NO delete(), NO TRUNCATE.
  // Note: NO mock users, candidates, companies, or applications.

  await prisma.$transaction(async (tx) => {
    // 1. Master Skills Catalog
    const skillsData = [
      { name: 'React', category: SkillCategory.FRONTEND, slug: 'react' },
      { name: 'Next.js', category: SkillCategory.FRONTEND, slug: 'nextjs' },
      { name: 'TypeScript', category: SkillCategory.FRONTEND, slug: 'typescript' },
      { name: 'JavaScript', category: SkillCategory.FRONTEND, slug: 'javascript' },
      { name: 'Tailwind CSS', category: SkillCategory.FRONTEND, slug: 'tailwindcss' },
      { name: 'Node.js', category: SkillCategory.BACKEND, slug: 'nodejs' },
      { name: 'NestJS', category: SkillCategory.BACKEND, slug: 'nestjs' },
      { name: 'Express', category: SkillCategory.BACKEND, slug: 'express' },
      { name: 'Python', category: SkillCategory.BACKEND, slug: 'python' },
      { name: 'FastAPI', category: SkillCategory.BACKEND, slug: 'fastapi' },
      { name: 'PostgreSQL', category: SkillCategory.DATABASE, slug: 'postgresql' },
      { name: 'MongoDB', category: SkillCategory.DATABASE, slug: 'mongodb' },
      { name: 'Prisma', category: SkillCategory.DATABASE, slug: 'prisma' },
      { name: 'Redis', category: SkillCategory.DATABASE, slug: 'redis' },
      { name: 'Docker', category: SkillCategory.DEVOPS, slug: 'docker' },
      { name: 'Kubernetes', category: SkillCategory.DEVOPS, slug: 'kubernetes' },
      { name: 'AWS', category: SkillCategory.DEVOPS, slug: 'aws' },
      { name: 'Jest', category: SkillCategory.TESTING, slug: 'jest' },
      { name: 'Cypress', category: SkillCategory.TESTING, slug: 'cypress' },
    ];

    const skillMap = new Map<string, string>();
    for (const s of skillsData) {
      const skill = await tx.skill.upsert({
        where: { slug: s.slug },
        update: { name: s.name, category: s.category },
        create: s,
      });
      skillMap.set(s.name, skill.id);
    }
    console.log(`✅ Master Skills upserted: ${skillsData.length} records`);

    // 2. Skill Frameworks
    const azureFw = await tx.skillFramework.upsert({
      where: { code: 'AZ-204' },
      update: {
        name: 'Microsoft Certified: Azure Developer Associate',
        provider: 'MICROSOFT',
        description: 'Industry-standard skills for cloud developer role across compute, storage, security and monitoring.',
      },
      create: {
        name: 'Microsoft Certified: Azure Developer Associate',
        provider: 'MICROSOFT',
        code: 'AZ-204',
        description: 'Industry-standard skills for cloud developer role across compute, storage, security and monitoring.',
      },
    });

    const nodeId = skillMap.get('Node.js');
    const dockerId = skillMap.get('Docker');
    const pgId = skillMap.get('PostgreSQL');

    if (nodeId && dockerId && pgId) {
      const frameworkItems = [
        { topicName: 'Develop Azure compute solutions', skillId: nodeId, level: 'ASSOCIATE', requiredScore: 70 },
        { topicName: 'Implement containerized solutions', skillId: dockerId, level: 'ASSOCIATE', requiredScore: 65 },
        { topicName: 'Connect to and consume Azure services & databases', skillId: pgId, level: 'ASSOCIATE', requiredScore: 70 },
      ];

      for (const item of frameworkItems) {
        const existing = await tx.skillFrameworkItem.findFirst({
          where: { frameworkId: azureFw.id, topicName: item.topicName },
        });
        if (!existing) {
          await tx.skillFrameworkItem.create({
            data: {
              frameworkId: azureFw.id,
              skillId: item.skillId,
              topicName: item.topicName,
              level: item.level,
              requiredScore: item.requiredScore,
            },
          });
        }
      }
    }
    console.log('✅ Skill Frameworks upserted: AZ-204');

    // 3. Master Assessments
    // 3.1 Theory Assessment
    const tsSkillId = skillMap.get('TypeScript');
    const theoryAssessment = await tx.assessment.upsert({
      where: { slug: 'full-stack-js-ts-core' },
      update: {
        title: 'Full Stack JavaScript & TypeScript Core Assessment',
        description: 'Comprehensive evaluation covering modern JavaScript ES6+, TypeScript type safety, React hooks, and asynchronous NodeJS runtime.',
        type: AssessmentType.THEORY,
        skillId: tsSkillId,
        timeLimitMinutes: 20,
        passingScore: 70,
      },
      create: {
        title: 'Full Stack JavaScript & TypeScript Core Assessment',
        slug: 'full-stack-js-ts-core',
        description: 'Comprehensive evaluation covering modern JavaScript ES6+, TypeScript type safety, React hooks, and asynchronous NodeJS runtime.',
        type: AssessmentType.THEORY,
        skillId: tsSkillId,
        timeLimitMinutes: 20,
        passingScore: 70,
      },
    });

    const theoryQuestions = [
      {
        title: 'Event Loop & Microtasks in Node.js',
        prompt: 'In Node.js, which queue has the highest priority and will execute immediately after the current operation finishes, before any other I/O callbacks or timers?',
        difficulty: QuestionDifficulty.MEDIUM,
        points: 25,
        explanation: 'process.nextTick() callbacks run immediately after the current phase completes, before the event loop continues to any other microtask or macrotask queue.',
        choices: [
          { text: 'process.nextTick() queue', isCorrect: true, order: 1 },
          { text: 'setImmediate() check queue', isCorrect: false, order: 2 },
          { text: 'setTimeout(..., 0) timer queue', isCorrect: false, order: 3 },
          { text: 'I/O polling queue', isCorrect: false, order: 4 },
        ],
      },
      {
        title: 'TypeScript Type Narrowing',
        prompt: 'Which TypeScript operator or construct is recommended for narrowing down a discriminated union type safely at runtime?',
        difficulty: QuestionDifficulty.EASY,
        points: 25,
        explanation: 'Discriminated unions use a common literal property (like type: "A" | "B") and can be narrowed safely with switch or if statements.',
        choices: [
          { text: 'Switch statement on common discriminator property', isCorrect: true, order: 1 },
          { text: 'as any type assertion', isCorrect: false, order: 2 },
          { text: 'typeof operator on non-primitive objects', isCorrect: false, order: 3 },
          { text: 'JSON.stringify comparison', isCorrect: false, order: 4 },
        ],
      },
    ];

    for (const q of theoryQuestions) {
      const existingQ = await tx.question.findFirst({
        where: { assessmentId: theoryAssessment.id, title: q.title },
      });
      if (!existingQ) {
        await tx.question.create({
          data: {
            assessmentId: theoryAssessment.id,
            title: q.title,
            prompt: q.prompt,
            difficulty: q.difficulty,
            points: q.points,
            explanation: q.explanation,
            choices: {
              create: q.choices,
            },
          },
        });
      }
    }

    // 3.2 Practical Coding Assessment
    const jsSkillId = skillMap.get('JavaScript');
    const codingAssessment = await tx.assessment.upsert({
      where: { slug: 'coding-algorithm-sandbox' },
      update: {
        title: 'Practical Coding: Algorithm & Data Manipulation Sandbox',
        description: 'Write, debug, and execute clean JavaScript/TypeScript algorithms tested against automated test cases in the Judge0 sandbox.',
        type: AssessmentType.PRACTICAL_CODING,
        skillId: jsSkillId,
        timeLimitMinutes: 30,
        passingScore: 70,
      },
      create: {
        title: 'Practical Coding: Algorithm & Data Manipulation Sandbox',
        slug: 'coding-algorithm-sandbox',
        description: 'Write, debug, and execute clean JavaScript/TypeScript algorithms tested against automated test cases in the Judge0 sandbox.',
        type: AssessmentType.PRACTICAL_CODING,
        skillId: jsSkillId,
        timeLimitMinutes: 30,
        passingScore: 70,
      },
    });

    const codingQuestions = [
      {
        title: 'Two Sum Target Matcher',
        prompt: 'Write a function `solution(numbers, target)` that takes a comma-separated list of numbers and a target integer. Return the indices of the two numbers that add up to target as "index1,index2" (0-indexed). Example: input "2,7,11,15" with target 9 should return "0,1".',
        difficulty: QuestionDifficulty.MEDIUM,
        points: 50,
        starterCode: `function solution(numsStr, target) {
  const nums = String(numsStr).split(',').map(n => Number(n.trim()));
  const targetNum = Number(target);
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = targetNum - nums[i];
    if (map.has(complement)) {
      return map.get(complement) + ',' + i;
    }
    map.set(nums[i], i);
  }
  return '';
}`,
        testCases: [
          { input: '2,7,11,15, 9', expectedOutput: '0,1' },
          { input: '3,2,4, 6', expectedOutput: '1,2' },
          { input: '3,3, 6', expectedOutput: '0,1' },
        ],
      },
    ];

    for (const q of codingQuestions) {
      const existingQ = await tx.question.findFirst({
        where: { assessmentId: codingAssessment.id, title: q.title },
      });
      if (!existingQ) {
        await tx.question.create({
          data: {
            assessmentId: codingAssessment.id,
            title: q.title,
            prompt: q.prompt,
            difficulty: q.difficulty,
            points: q.points,
            starterCode: q.starterCode,
            testCases: q.testCases,
          },
        });
      }
    }
    console.log('✅ Master Assessments & Coding Questions upserted');

    // 4. Initial Curated Courses
    const coursesData = [
      {
        title: 'Docker & Kubernetes Mastery - Containerization from Scratch',
        provider: CourseSource.YOUTUBE,
        description: 'Comprehensive hands-on guide covering Dockerfiles, multi-stage builds, Docker Compose, Kubernetes pods, deployments, and services.',
        url: 'https://www.youtube.com/watch?v=fqMOX6JJhGo',
        thumbnailUrl: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?w=400&h=225&fit=crop',
        duration: '4 hours',
        level: 'Beginner to Intermediate',
        rating: 4.9,
      },
      {
        title: 'Advanced PostgreSQL Performance Optimization and Indexing',
        provider: CourseSource.YOUTUBE,
        description: 'Master database tuning, query plan analysis with EXPLAIN ANALYZE, B-Trees, connection pooling, and schema design.',
        url: 'https://www.youtube.com/watch?v=qw--VYLpxG4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&h=225&fit=crop',
        duration: '3 hours',
        level: 'Intermediate to Advanced',
        rating: 4.8,
      },
    ];

    for (const c of coursesData) {
      const existingCourse = await tx.course.findFirst({
        where: { url: c.url },
      });
      if (!existingCourse) {
        await tx.course.create({ data: c });
      }
    }
    console.log('✅ Curated Reference Courses upserted');
  });

  console.log('🎉 Production Non-Destructive Master Seeding Completed Successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Production Seeding failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
