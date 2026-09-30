const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const additionalCourses = [
  {
    title: 'CSS3 & Modern Responsive Web Design (Flexbox, Grid & Animations)',
    provider: 'YOUTUBE',
    description: 'Master CSS3, modern layouts with Flexbox and CSS Grid, responsive design techniques, and micro-interactions.',
    url: 'https://www.youtube.com/watch?v=1PnVor36_40',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&h=225&fit=crop',
    duration: '6 hours',
    level: 'Beginner to Intermediate',
    skills: ['CSS3', 'HTML5', 'Bootstrap'],
  },
  {
    title: 'Building Production-Ready REST APIs & Microservices Architecture',
    provider: 'YOUTUBE',
    description: 'Complete guide to designing, building, and securing RESTful APIs with Node.js, Express, Axios, and OpenAPI specs.',
    url: 'https://www.youtube.com/watch?v=-MTSQjw5DrM',
    thumbnailUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
    duration: '4.5 hours',
    level: 'Intermediate',
    skills: ['REST APIs', 'Node.js', 'Express'],
  },
  {
    title: 'HTML5 & Modern Web Semantics Complete Crash Course',
    provider: 'YOUTUBE',
    description: 'Learn modern HTML5 semantic tags, web accessibility (a11y), forms validation, and SEO best practices.',
    url: 'https://www.youtube.com/watch?v=kUMe1FH4CHE',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=225&fit=crop',
    duration: '3 hours',
    level: 'Beginner',
    skills: ['HTML5', 'JavaScript'],
  },
  {
    title: 'Angular 17+ Full Course - From Fundamentals to Enterprise Apps',
    provider: 'UDEMY',
    description: 'Master Angular components, signals, standalone components, RxJS reactive patterns, and routing.',
    url: 'https://www.udemy.com/course/the-complete-guide-to-angular-2/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=225&fit=crop',
    duration: '34 hours',
    level: 'Intermediate to Advanced',
    skills: ['Angular', 'TypeScript', 'RxJS'],
  },
  {
    title: 'Spring Boot 3 & Java Enterprise Masterclass',
    provider: 'UDEMY',
    description: 'Build enterprise backend microservices with Java, Spring Boot 3, Spring Data JPA, and PostgreSQL.',
    url: 'https://www.udemy.com/course/spring-hibernate-tutorial/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400&h=225&fit=crop',
    duration: '42 hours',
    level: 'Intermediate',
    skills: ['Spring Boot', 'Java', 'SQL', 'PostgreSQL'],
  },
  {
    title: 'Git & GitHub Complete Workflow with CI/CD Pipelines',
    provider: 'YOUTUBE',
    description: 'Professional version control: branching strategies, merge conflicts, pull requests, and GitHub Actions CI/CD.',
    url: 'https://www.youtube.com/watch?v=RGOj5yH7evk',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=400&h=225&fit=crop',
    duration: '2.5 hours',
    level: 'All Levels',
    skills: ['Git', 'CI/CD', 'Linux'],
  },
  {
    title: 'Automated Testing with Jest, Playwright & Cypress',
    provider: 'UDEMY',
    description: 'Full-stack testing guide: Unit testing with Jest, E2E testing with Playwright and Cypress for web apps.',
    url: 'https://www.udemy.com/course/automated-software-testing-with-playwright/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&h=225&fit=crop',
    duration: '18 hours',
    level: 'Intermediate',
    skills: ['Automated Testing', 'Jest', 'Playwright', 'Cypress'],
  },
  {
    title: 'Tailwind CSS 3: Build Modern, Sleek UIs Fast',
    provider: 'YOUTUBE',
    description: 'Learn utility-first CSS, dark mode design, custom configurations, and responsive mobile-first interfaces.',
    url: 'https://www.youtube.com/watch?v=dFgzHOX84xQ',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&h=225&fit=crop',
    duration: '4 hours',
    level: 'Beginner to Intermediate',
    skills: ['Tailwind CSS', 'CSS3'],
  },
  {
    title: 'Redux Toolkit & State Management in Modern React',
    provider: 'YOUTUBE',
    description: 'Master global state management using Redux Toolkit (RTK), createAsyncThunk, and RTK Query.',
    url: 'https://www.youtube.com/watch?v=9zySeP5vH9c',
    thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=225&fit=crop',
    duration: '3.5 hours',
    level: 'Intermediate',
    skills: ['Redux', 'React', 'TypeScript'],
  },
  {
    title: 'FastAPI & Python Microservices - High Performance APIs',
    provider: 'UDEMY',
    description: 'Build lightning-fast asynchronous REST APIs with Python 3, FastAPI, Pydantic, and Docker.',
    url: 'https://www.udemy.com/course/fastapi-the-complete-course/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=400&h=225&fit=crop',
    duration: '16 hours',
    level: 'Intermediate',
    skills: ['FastAPI', 'Python', 'Docker', 'REST APIs'],
  },
];

async function main() {
  console.log('Seeding curated courses and linking CourseSkills...');

  for (const c of additionalCourses) {
    let course = await prisma.course.findFirst({
      where: { title: c.title },
    });

    if (!course) {
      course = await prisma.course.create({
        data: {
          title: c.title,
          provider: c.provider,
          description: c.description,
          url: c.url,
          thumbnailUrl: c.thumbnailUrl,
          duration: c.duration,
          level: c.level,
        },
      });
      console.log(`Created course: ${c.title}`);
    }

    // Link CourseSkills
    for (const skillName of c.skills) {
      const skill = await prisma.skill.findUnique({
        where: { name: skillName },
      });

      if (skill) {
        await prisma.courseSkill.upsert({
          where: {
            courseId_skillId: {
              courseId: course.id,
              skillId: skill.id,
            },
          },
          update: {},
          create: {
            courseId: course.id,
            skillId: skill.id,
            relevanceScore: 1.0,
          },
        });
      }
    }
  }

  // Also link existing courses if they have matching skills
  const existingCourses = await prisma.course.findMany();
  for (const ec of existingCourses) {
    const text = `${ec.title} ${ec.description || ''}`.toLowerCase();
    const skills = await prisma.skill.findMany();
    for (const s of skills) {
      if (text.includes(s.name.toLowerCase())) {
        await prisma.courseSkill.upsert({
          where: {
            courseId_skillId: {
              courseId: ec.id,
              skillId: s.id,
            },
          },
          update: {},
          create: {
            courseId: ec.id,
            skillId: s.id,
            relevanceScore: 1.0,
          },
        }).catch(() => {});
      }
    }
  }

  const count = await prisma.course.count();
  const csCount = await prisma.courseSkill.count();
  console.log(`Done! Total courses: ${count}, Total CourseSkill connections: ${csCount}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
