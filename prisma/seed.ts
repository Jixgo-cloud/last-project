import { PrismaClient, UserRole, VerificationStatus, ApplicationStatus, AssessmentType, QuestionDifficulty, JobSource, JobType, CourseSource, SkillCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SmartCareer Database...');

  // Clear existing data in reverse order of dependencies
  await prisma.ingestionLog.deleteMany();
  await prisma.companyEvaluation.deleteMany();
  await prisma.applicationStatusHistory.deleteMany();
  await prisma.jobApplication.deleteMany();
  await prisma.jobSkill.deleteMany();
  await prisma.job.deleteMany();
  await prisma.assessmentAnswer.deleteMany();
  await prisma.assessmentAttempt.deleteMany();
  await prisma.choice.deleteMany();
  await prisma.question.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.courseSkill.deleteMany();
  await prisma.course.deleteMany();
  await prisma.skillFrameworkItem.deleteMany();
  await prisma.skillFramework.deleteMany();
  await prisma.gitHubEvidence.deleteMany();
  await prisma.gitHubRepository.deleteMany();
  await prisma.candidateSkill.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.companyVerification.deleteMany();
  await prisma.companyMember.deleteMany();
  await prisma.company.deleteMany();
  await prisma.candidateProfile.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = bcrypt.hashSync('password123', 10);
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);

  // 1. Create Users
  // Candidate
  const candidateUser = await prisma.user.create({
    data: {
      email: 'candidate@smartcareer.dev',
      passwordHash: defaultPasswordHash,
      role: UserRole.CANDIDATE,
    },
  });

  const candidateProfile = await prisma.candidateProfile.create({
    data: {
      userId: candidateUser.id,
      fullName: 'Natdanai Siripol (Alex)',
      headline: 'Passionate Full Stack Developer | Next.js & NestJS Specialist',
      bio: 'Enthusiastic software engineer with 2+ years of experience building modern web apps, APIs, and scalable distributed architectures.',
      targetCareer: 'Full Stack Developer',
      githubUsername: 'natdanai-dev',
      githubConnectedAt: new Date(),
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
      education: [
        { degree: 'B.Sc. in Computer Science', school: 'Chulalongkorn University', year: '2020 - 2024' },
      ],
      experience: [
        {
          title: 'Junior Full Stack Developer',
          company: 'Siam Digital Lab',
          duration: '2023 - Present',
          desc: 'Developed customer portal with Next.js, TypeScript, and NestJS microservices.',
        },
      ],
    },
  });

  // Company 1 (Verified)
  const companyUser1 = await prisma.user.create({
    data: {
      email: 'hr@techcorp.co.th',
      passwordHash: defaultPasswordHash,
      role: UserRole.COMPANY,
    },
  });

  const company1 = await prisma.company.create({
    data: {
      name: 'TechCorp Solutions Thailand',
      slug: 'techcorp-thailand',
      description: 'Leading enterprise cloud innovation and digital transformation powerhouse based in Bangkok.',
      website: 'https://techcorp.co.th',
      address: 'Sathorn Square Tower, 28th Floor, Bangkok',
      contactEmail: 'contact@techcorp.co.th',
      contactPhone: '+66 2 123 4567',
      logoUrl: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=150&h=150&fit=crop',
      verificationStatus: VerificationStatus.VERIFIED,
      members: {
        create: {
          userId: companyUser1.id,
          role: 'OWNER',
        },
      },
      verifications: {
        create: {
          businessRegNo: '0105562089123',
          status: VerificationStatus.VERIFIED,
          reviewedAt: new Date(),
        },
      },
    },
  });

  // Company 2 (Pending Verification)
  const companyUser2 = await prisma.user.create({
    data: {
      email: 'founder@innovatestartup.io',
      passwordHash: defaultPasswordHash,
      role: UserRole.COMPANY,
    },
  });

  await prisma.company.create({
    data: {
      name: 'InnovateAI Startup',
      slug: 'innovate-ai',
      description: 'Next-gen generative AI solutions for automated customer engagement and data analytics.',
      website: 'https://innovatestartup.io',
      address: 'True Digital Park, Sukhumvit 101, Bangkok',
      contactEmail: 'hello@innovatestartup.io',
      verificationStatus: VerificationStatus.PENDING,
      members: {
        create: {
          userId: companyUser2.id,
          role: 'OWNER',
        },
      },
      verifications: {
        create: {
          businessRegNo: '0105566012948',
          status: VerificationStatus.PENDING,
        },
      },
    },
  });

  // Admin
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@smartcareer.dev',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    },
  });

  // 2. Master Skills
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

  const createdSkills = new Map<string, any>();
  for (const s of skillsData) {
    const skill = await prisma.skill.create({ data: s });
    createdSkills.set(s.name, skill);
  }

  // 3. Link Skills to Candidate with Practical & Verified scores
  const candidateSkillsInit = [
    { skillName: 'React', practical: 88, theory: 85, coding: 80 },
    { skillName: 'Next.js', practical: 82, theory: 80, coding: 75 },
    { skillName: 'TypeScript', practical: 85, theory: 90, coding: 85 },
    { skillName: 'Node.js', practical: 78, theory: 75, coding: 70 },
    { skillName: 'NestJS', practical: 75, theory: 80, coding: 75 },
    { skillName: 'PostgreSQL', practical: 70, theory: 70, coding: 65 },
    { skillName: 'Prisma', practical: 80, theory: 85, coding: 80 },
    { skillName: 'Docker', practical: 55, theory: 50, coding: 40 },
    { skillName: 'Jest', practical: 65, theory: 60, coding: 55 },
  ];

  for (const cs of candidateSkillsInit) {
    const skill = createdSkills.get(cs.skillName);
    if (skill) {
      const verifiedScore = Math.round(cs.practical * 0.5 + cs.theory * 0.2 + cs.coding * 0.3);
      await prisma.candidateSkill.create({
        data: {
          candidateId: candidateProfile.id,
          skillId: skill.id,
          practicalScore: cs.practical,
          theoryScore: cs.theory,
          codingScore: cs.coding,
          verifiedScore,
          isVerified: verifiedScore >= 60,
          verifiedAt: new Date(),
        },
      });
    }
  }

  // 4. Candidate GitHub Repos & Evidences
  const repo1 = await prisma.gitHubRepository.create({
    data: {
      candidateId: candidateProfile.id,
      repoName: 'next-prisma-commerce',
      fullName: 'natdanai-dev/next-prisma-commerce',
      description: 'Production-ready eCommerce platform built with Next.js App Router, Prisma ORM, and PostgreSQL.',
      url: 'https://github.com/natdanai-dev/next-prisma-commerce',
      language: 'TypeScript',
      stargazersCount: 34,
      forksCount: 8,
      topics: ['nextjs', 'typescript', 'prisma', 'postgresql', 'tailwind'],
    },
  });

  const repo2 = await prisma.gitHubRepository.create({
    data: {
      candidateId: candidateProfile.id,
      repoName: 'nestjs-microservices-auth',
      fullName: 'natdanai-dev/nestjs-microservices-auth',
      description: 'Distributed authentication service using NestJS, Redis, and JWT verification.',
      url: 'https://github.com/natdanai-dev/nestjs-microservices-auth',
      language: 'TypeScript',
      stargazersCount: 19,
      forksCount: 4,
      topics: ['nestjs', 'docker', 'redis', 'jest'],
    },
  });

  // 5. Skill Frameworks
  const azureFw = await prisma.skillFramework.create({
    data: {
      name: 'Microsoft Certified: Azure Developer Associate',
      provider: 'MICROSOFT',
      code: 'AZ-204',
      description: 'Industry-standard skills for cloud developer role across compute, storage, security and monitoring.',
      items: {
        create: [
          { skillId: createdSkills.get('Node.js').id, topicName: 'Develop Azure compute solutions', level: 'ASSOCIATE', requiredScore: 70 },
          { skillId: createdSkills.get('Docker').id, topicName: 'Implement containerized solutions', level: 'ASSOCIATE', requiredScore: 65 },
          { skillId: createdSkills.get('PostgreSQL').id, topicName: 'Connect to and consume Azure services & databases', level: 'ASSOCIATE', requiredScore: 70 },
        ],
      },
    },
  });

  // 6. Job Postings
  // Job 1 (Internal from TechCorp)
  const job1 = await prisma.job.create({
    data: {
      companyId: company1.id,
      companyName: company1.name,
      companyLogoUrl: company1.logoUrl,
      title: 'Senior Full Stack Engineer (Next.js & NestJS)',
      slug: 'senior-full-stack-engineer-techcorp',
      description: 'We are seeking a talented Senior Full Stack Engineer to lead the architectural evolution of our enterprise platforms. You will work directly with our engineering director and cross-functional teams to build resilient high-traffic services.',
      requirements: 'Strong experience with React, Next.js, TypeScript, NestJS, and relational databases like PostgreSQL. Familiarity with Docker and testing frameworks is preferred.',
      benefits: 'Competitive salary, provident fund (up to 10%), flexible hybrid schedule (3 days remote), modern MacBook Pro M3, annual learning stipend (50,000 THB).',
      location: 'Sathorn, Bangkok',
      isRemote: true,
      employmentType: JobType.FULL_TIME,
      salaryMin: 90000,
      salaryMax: 150000,
      salaryCurrency: 'THB',
      source: JobSource.INTERNAL,
      skills: {
        create: [
          { skillId: createdSkills.get('Next.js').id, isRequired: true, minimumScore: 70 },
          { skillId: createdSkills.get('TypeScript').id, isRequired: true, minimumScore: 75 },
          { skillId: createdSkills.get('NestJS').id, isRequired: true, minimumScore: 70 },
          { skillId: createdSkills.get('PostgreSQL').id, isRequired: true, minimumScore: 65 },
          { skillId: createdSkills.get('Docker').id, isRequired: false, minimumScore: 50 },
          { skillId: createdSkills.get('Jest').id, isRequired: false, minimumScore: 50 },
        ],
      },
    },
  });

  // Job 2 (Internal from TechCorp)
  const job2 = await prisma.job.create({
    data: {
      companyId: company1.id,
      companyName: company1.name,
      companyLogoUrl: company1.logoUrl,
      title: 'Frontend React / Next.js Specialist',
      slug: 'frontend-react-specialist-techcorp',
      description: 'Design and deliver pixel-perfect user interfaces with cutting-edge micro-interactions and high-performance Web Vitals.',
      requirements: 'Deep knowledge of React 18, Next.js App Router, Tailwind CSS, TypeScript, and responsive web design.',
      benefits: 'Hybrid work model, health insurance, bonus, wellness stipend.',
      location: 'Sathorn, Bangkok',
      isRemote: true,
      employmentType: JobType.FULL_TIME,
      salaryMin: 70000,
      salaryMax: 110000,
      source: JobSource.INTERNAL,
      skills: {
        create: [
          { skillId: createdSkills.get('React').id, isRequired: true, minimumScore: 80 },
          { skillId: createdSkills.get('Next.js').id, isRequired: true, minimumScore: 75 },
          { skillId: createdSkills.get('Tailwind CSS').id, isRequired: true, minimumScore: 75 },
          { skillId: createdSkills.get('TypeScript').id, isRequired: true, minimumScore: 70 },
        ],
      },
    },
  });

  // Job 3 (External Remotive)
  await prisma.job.create({
    data: {
      title: 'Staff Backend Platform Engineer (Remote)',
      slug: 'staff-backend-platform-engineer-remotive',
      companyName: 'Global Cloud Systems Inc.',
      companyLogoUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=128&h=128&fit=crop',
      description: 'Join our fully distributed team building cloud telemetry and event-driven microservices processing over 500k events/sec.',
      requirements: 'Proven experience building distributed backend services with Node.js/NestJS, Docker, Kubernetes, and PostgreSQL.',
      location: 'Worldwide Remote',
      isRemote: true,
      employmentType: JobType.FULL_TIME,
      salaryMin: 120000,
      salaryMax: 180000,
      source: JobSource.REMOTIVE,
      externalId: 'remotive-2026-991',
      sourceUrl: 'https://remotive.com',
      skills: {
        create: [
          { skillId: createdSkills.get('Node.js').id, isRequired: true, minimumScore: 85 },
          { skillId: createdSkills.get('Docker').id, isRequired: true, minimumScore: 75 },
          { skillId: createdSkills.get('PostgreSQL').id, isRequired: true, minimumScore: 75 },
        ],
      },
    },
  });

  // 7. Job Application for Candidate
  const application1 = await prisma.jobApplication.create({
    data: {
      jobId: job1.id,
      candidateId: candidateProfile.id,
      status: ApplicationStatus.TECHNICAL_TEST,
      coverLetter: 'I am thrilled to apply for this Senior Full Stack role. With my background in Next.js and NestJS, I am confident in adding immediate value to TechCorp.',
      matchScoreAtApplication: 82,
      internalNote: 'Candidate has very strong GitHub evidence and practical TypeScript skills.',
      statusHistory: {
        create: [
          { newStatus: ApplicationStatus.APPLIED, note: 'Applied online' },
          { previousStatus: ApplicationStatus.APPLIED, newStatus: ApplicationStatus.REVIEWING, note: 'Profile reviewed by HR' },
          { previousStatus: ApplicationStatus.REVIEWING, newStatus: ApplicationStatus.TECHNICAL_TEST, note: 'Invited for Coding Sandbox Assessment' },
        ],
      },
    },
  });

  // 8. Company Evaluation on Candidate
  await prisma.companyEvaluation.create({
    data: {
      applicationId: application1.id,
      companyId: company1.id,
      candidateId: candidateProfile.id,
      technicalScore: 4,
      problemSolvingScore: 4,
      communicationScore: 5,
      teamworkScore: 4,
      overallFeedback: 'Alex demonstrated exceptional mastery in TypeScript and Next.js App Router architecture. Code quality was clean and well structured. Could expand on container orchestration with Docker & Kubernetes for cloud deployment.',
      strengths: ['Modern React patterns', 'Clean API architecture in NestJS', 'Clear communication'],
      areasForImprovement: ['Docker container optimization', 'Kubernetes cluster deployment'],
    },
  });

  // 9. Assessments
  // Theory Assessment
  const theoryAssessment = await prisma.assessment.create({
    data: {
      title: 'Full Stack JavaScript & TypeScript Core Assessment',
      slug: 'full-stack-js-ts-core',
      description: 'Comprehensive evaluation covering modern JavaScript ES6+, TypeScript type safety, React hooks, and asynchronous NodeJS runtime.',
      type: AssessmentType.THEORY,
      skillId: createdSkills.get('TypeScript').id,
      timeLimitMinutes: 20,
      passingScore: 70,
      questions: {
        create: [
          {
            title: 'Event Loop & Microtasks in Node.js',
            prompt: 'In Node.js, which queue has the highest priority and will execute immediately after the current operation finishes, before any other I/O callbacks or timers?',
            difficulty: QuestionDifficulty.MEDIUM,
            points: 25,
            explanation: 'process.nextTick() callbacks run immediately after the current phase completes, before the event loop continues to any other microtask or macrotask queue.',
            choices: {
              create: [
                { text: 'process.nextTick() queue', isCorrect: true, order: 1 },
                { text: 'setImmediate() check queue', isCorrect: false, order: 2 },
                { text: 'setTimeout(..., 0) timer queue', isCorrect: false, order: 3 },
                { text: 'I/O polling queue', isCorrect: false, order: 4 },
              ],
            },
          },
          {
            title: 'TypeScript Type Narrowing',
            prompt: 'Which TypeScript operator or construct is recommended for narrowing down a discriminated union type safely at runtime?',
            difficulty: QuestionDifficulty.EASY,
            points: 25,
            explanation: 'Discriminated unions use a common literal property (like type: "A" | "B") and can be narrowed safely with switch or if statements.',
            choices: {
              create: [
                { text: 'Switch statement on common discriminator property', isCorrect: true, order: 1 },
                { text: 'as any type assertion', isCorrect: false, order: 2 },
                { text: 'typeof operator on non-primitive objects', isCorrect: false, order: 3 },
                { text: 'JSON.stringify comparison', isCorrect: false, order: 4 },
              ],
            },
          },
          {
            title: 'React Server Components (RSC)',
            prompt: 'What is a primary architectural benefit of React Server Components in Next.js App Router?',
            difficulty: QuestionDifficulty.MEDIUM,
            points: 25,
            explanation: 'React Server Components execute strictly on the server and send zero client-side JavaScript bundle for those components, drastically reducing initial load time.',
            choices: {
              create: [
                { text: 'Zero bundle size overhead for server-only dependencies on the client', isCorrect: true, order: 1 },
                { text: 'Automatic WebGL rendering in the browser', isCorrect: false, order: 2 },
                { text: 'Elimination of all HTTP requests in the app', isCorrect: false, order: 3 },
                { text: 'Forced localStorage synchronization', isCorrect: false, order: 4 },
              ],
            },
          },
          {
            title: 'SQL Connection Pooling in NestJS with Prisma',
            prompt: 'Why is connection pooling essential when deploying NestJS services to containerized or serverless environments connecting to PostgreSQL?',
            difficulty: QuestionDifficulty.EASY,
            points: 25,
            explanation: 'PostgreSQL processes each connection with a dedicated process. Connection pooling reuses open sockets and prevents exhausting database max_connections.',
            choices: {
              create: [
                { text: 'Reuses database sockets and prevents exceeding PostgreSQL max_connections', isCorrect: true, order: 1 },
                { text: 'Encrypts hard drives on the server automatically', isCorrect: false, order: 2 },
                { text: 'Converts SQL queries directly into NoSQL documents', isCorrect: false, order: 3 },
                { text: 'Removes the need for database indexes', isCorrect: false, order: 4 },
              ],
            },
          },
        ],
      },
    },
  });

  // Practical Coding Assessment (Judge0 / Monaco Editor)
  const codingAssessment = await prisma.assessment.create({
    data: {
      title: 'Practical Coding: Algorithm & Data Manipulation Sandbox',
      slug: 'coding-algorithm-sandbox',
      description: 'Write, debug, and execute clean JavaScript/TypeScript algorithms tested against automated test cases in the Judge0 sandbox.',
      type: AssessmentType.PRACTICAL_CODING,
      skillId: createdSkills.get('JavaScript').id,
      timeLimitMinutes: 30,
      passingScore: 70,
      questions: {
        create: [
          {
            title: 'Two Sum Target Matcher',
            prompt: 'Write a function `solution(numbers, target)` that takes a comma-separated list of numbers and a target integer. Return the indices of the two numbers that add up to target as "index1,index2" (0-indexed). Example: input "2,7,11,15" with target 9 should return "0,1".',
            difficulty: QuestionDifficulty.MEDIUM,
            points: 50,
            starterCode: `// Write your solution here
function solution(numsStr, target) {
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
              { input: '1,5,3,7, 8', expectedOutput: '1,2', isHidden: true },
              { input: '0,4,3,0, 0', expectedOutput: '0,3', isHidden: true },
            ],
          },
          {
            title: 'Valid Palindrome Verifier',
            prompt: 'Write a function `solution(str)` that checks whether a given string is a palindrome, considering only alphanumeric characters and ignoring cases. Return `true` or `false`. Example: "A man, a plan, a canal: Panama" => true.',
            difficulty: QuestionDifficulty.EASY,
            points: 50,
            starterCode: `// Write your solution here
function solution(str) {
  const clean = String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === clean.split('').reverse().join('');
}`,
            testCases: [
              { input: 'A man, a plan, a canal: Panama', expectedOutput: 'true' },
              { input: 'race a car', expectedOutput: 'false' },
              { input: ' ', expectedOutput: 'true' },
              { input: 'Was it a car or a cat I saw?', expectedOutput: 'true', isHidden: true },
              { input: '12321', expectedOutput: 'true', isHidden: true },
              { input: '12345', expectedOutput: 'false', isHidden: true },
            ],
          },
        ],
      },
    },
  });

  // 10. Courses Catalog (YouTube & Udemy)
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
      skillName: 'Docker',
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
      skillName: 'PostgreSQL',
    },
    {
      title: 'NestJS Enterprise Architectural Patterns & Clean Code',
      provider: CourseSource.YOUTUBE,
      description: 'Build robust, scalable microservices with NestJS, Prisma, JWT Authentication, and automated unit testing.',
      url: 'https://www.youtube.com/watch?v=GHTA143_b-s',
      thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=225&fit=crop',
      duration: '5 hours',
      level: 'Intermediate',
      rating: 4.9,
      skillName: 'NestJS',
    },
    {
      title: 'Ultimate AWS Certified Developer Associate 2026',
      provider: CourseSource.UDEMY,
      description: 'Complete hands-on training for AWS Lambda, ECS, DynamoDB, API Gateway, and CloudFormation.',
      url: 'https://www.udemy.com/course/aws-certified-developer-associate-dva-c01/',
      thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=225&fit=crop',
      duration: '32 hours',
      level: 'Intermediate',
      rating: 4.9,
      skillName: 'AWS',
    },
    {
      title: 'React & Next.js 14 - The Complete Full Stack Guide',
      provider: CourseSource.UDEMY,
      description: 'Learn Server Actions, App Router, Suspense, Tailwind CSS, and build production web apps.',
      url: 'https://www.udemy.com/course/react-the-complete-guide-incl-redux/',
      thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=225&fit=crop',
      duration: '48 hours',
      level: 'All Levels',
      rating: 4.8,
      skillName: 'Next.js',
    },
  ];

  for (const c of coursesData) {
    const course = await prisma.course.create({
      data: {
        title: c.title,
        provider: c.provider,
        description: c.description,
        url: c.url,
        thumbnailUrl: c.thumbnailUrl,
        duration: c.duration,
        level: c.level,
        rating: c.rating,
        source: c.provider === CourseSource.YOUTUBE ? 'YouTube' : 'Udemy',
        externalId: `seed-${c.skillName.toLowerCase()}`,
      },
    });

    const skill = createdSkills.get(c.skillName);
    if (skill) {
      await prisma.courseSkill.create({
        data: {
          courseId: course.id,
          skillId: skill.id,
          relevanceScore: 1.0,
        },
      });
    }
  }

  // 11. Initial Ingestion Audit Log
  await prisma.ingestionLog.create({
    data: {
      source: 'SEED_INITIALIZER',
      status: 'SUCCESS',
      startedAt: new Date(Date.now() - 3600000),
      finishedAt: new Date(),
      createdCount: 8,
      updatedCount: 0,
      duplicateCount: 0,
      errorCount: 0,
    },
  });

  console.log('✅ Seeding completed successfully!');
  console.log('Demo Credentials:');
  console.log('  Candidate: candidate@smartcareer.dev / password123');
  console.log('  Company:   hr@techcorp.co.th / password123');
  console.log('  Admin:     admin@smartcareer.dev / admin123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
