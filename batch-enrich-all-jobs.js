const { PrismaClient } = require('@prisma/client');
const { execFileSync } = require('child_process');
const cheerio = require('cheerio');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();
const apiKey = process.env.GEMINI_API_KEY;

// Helper: Split raw text into clean bullet points
function splitToBullets(text) {
  if (!text) return [];
  // Remove HTML tags
  let cleaned = text.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  
  // If text already has bullets or lines, split on newlines
  let lines = cleaned.split(/\n+/).map(l => l.trim()).filter(Boolean);
  
  // If it's a single big paragraph, split by sentence endings
  if (lines.length <= 1 && cleaned.length > 80) {
    lines = cleaned.split(/(?<=[.!?])\s+|;\s*/).map(l => l.trim()).filter(Boolean);
  }

  // Filter out headers like "รายละเอียดงาน:", "หน้าที่ความรับผิดชอบ:"
  const headerRegex = /^(หน้าที่ความรับผิดชอบ|รายละเอียดงาน|คุณสมบัติ|responsibilities|qualifications|requirements|job description|requirements:)/i;
  lines = lines.filter(l => !headerRegex.test(l) && l.length > 5);

  return lines.map(l => `- ${l.replace(/^[-•*·\d+\.\)]\s*/, '')}`);
}

// Helper: Split raw text into clean numbered items
function splitToNumbered(text) {
  if (!text) return [];
  let cleaned = text.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

  let lines = cleaned.split(/\n+/).map(l => l.trim()).filter(Boolean);

  if (lines.length <= 1 && cleaned.length > 80) {
    lines = cleaned.split(/(?<=[.!?])\s+|;\s*/).map(l => l.trim()).filter(Boolean);
  }

  const headerRegex = /^(หน้าที่ความรับผิดชอบ|รายละเอียดงาน|คุณสมบัติ|responsibilities|qualifications|requirements|job description|requirements:)/i;
  lines = lines.filter(l => !headerRegex.test(l) && l.length > 5);

  return lines.map((l, i) => `${i + 1}. ${l.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•*·]\s*/, '')}`);
}

// 1. JobThai Deep Extractor
function cleanJobThai(url) {
  try {
    const html = execFileSync('curl.exe', [
      '-s', '-L',
      '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      url
    ], { maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' });

    const idx = html.indexOf('JobPosting');
    if (idx === -1) return null;
    const start = html.lastIndexOf('{\\"@context\\"', idx);
    if (start === -1) return null;

    let sub = html.slice(start, start + 4000).replace(/\\"/g, '"').replace(/[\u0000-\u001F]+/g, (c) => (c === '\n' ? '\\n' : c === '\r' ? '' : ' '));
    let depth = 0, endIdx = -1;
    for (let i = 0; i < sub.length; i++) {
      if (sub[i] === '{') depth++;
      else if (sub[i] === '}') {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (endIdx === -1) return null;
    const jp = JSON.parse(sub.slice(0, endIdx + 1));

    const descItems = splitToBullets(jp.description);
    const reqItems = splitToNumbered(jp.qualifications);

    return {
      companyName: jp.hiringOrganization?.name || undefined,
      companyLogoUrl: jp.hiringOrganization?.logo || undefined,
      description: descItems.length > 0 ? descItems.join('\n') : undefined,
      requirements: reqItems.length > 0 ? reqItems.join('\n') : undefined,
      benefits: jp.jobBenefits ? splitToBullets(jp.jobBenefits).join('\n') : null,
    };
  } catch (e) {
    return null;
  }
}

// 2. JobsDB Deep Extractor
function cleanJobsDB(url) {
  try {
    const html = execFileSync('curl.exe', [
      '-s', '-L',
      '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      url
    ], { maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' });

    const reduxMatch = html.match(/window\.SEEK_REDUX_DATA\s*=\s*(\{.*?\});/s);
    if (!reduxMatch) return null;
    const data = JSON.parse(reduxMatch[1]);
    const job = data?.jobdetails?.result?.job;
    if (!job || !job.content) return null;

    const $ = cheerio.load(job.content);
    const bullets = [];
    $('li, p').each((_, el) => {
      const t = $(el).text().trim().replace(/\s+/g, ' ');
      if (t.length > 15 && t.length < 350 && !bullets.includes(t)) {
        bullets.push(t);
      }
    });

    if (bullets.length === 0) return null;

    const half = Math.max(3, Math.floor(bullets.length * 0.45));
    const descItems = bullets.slice(0, half);
    const reqItems = bullets.slice(half);

    const formattedDesc = descItems.map(b => `- ${b.replace(/^[-•*·\d+\.\)]\s*/, '')}`).join('\n');
    const formattedReq = (reqItems.length > 0 ? reqItems : descItems)
      .map((b, i) => `${i + 1}. ${b.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•*·]\s*/, '')}`)
      .join('\n');

    return {
      companyName: job.advertiser?.description || undefined,
      description: formattedDesc,
      requirements: formattedReq,
    };
  } catch (e) {
    return null;
  }
}

// 3. Fallback Generic Text Normalizer
function normalizeGenericText(rawDesc, rawReq) {
  const descItems = splitToBullets(rawDesc);
  const reqItems = splitToNumbered(rawReq);

  return {
    description: descItems.length > 0 ? descItems.join('\n') : `- ${rawDesc || 'Develop and maintain software solutions.'}`,
    requirements: reqItems.length > 0 ? reqItems.join('\n') : `1. ${rawReq || 'Experience in software engineering and problem-solving.'}`,
  };
}

// 4. AI & Tech Stack Extractor
async function extractSkills(title, description, requirements) {
  const combined = `${title} ${description} ${requirements}`.toLowerCase();
  let aiSkills = null;

  // Try Gemini AI if API key is present
  if (apiKey) {
    const candidateModels = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemma-4-26b-a4b-it'];
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const prompt = `Analyze this job posting and extract all required and preferred technical skills, tools, programming languages, and frameworks:
Title: ${title}
Description: ${description.slice(0, 1000)}
Requirements: ${requirements.slice(0, 1000)}

Return ONLY a valid JSON array of objects with keys:
- "name": string (canonical skill name, e.g. "React", "TypeScript", "Node.js", "PostgreSQL", "Docker", "Postman", "AWS", "Python", "Kubernetes", "Next.js")
- "category": string (one of: "FRONTEND", "BACKEND", "DATABASE", "DEVOPS", "TESTING", "MOBILE", "AI_ML", "SECURITY")
- "isRequired": boolean (true if mentioned in requirements/must-have, false if preferred/nice-to-have)
- "minimumScore": number (between 60 and 95, default 70)

Example:
[{"name":"React","category":"FRONTEND","isRequired":true,"minimumScore":75},{"name":"Node.js","category":"BACKEND","isRequired":true,"minimumScore":70}]`;

        const res = await axios.post(url, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
        }, { timeout: 10000 });

        const raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw) {
          const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
          const parsed = JSON.parse(clean);
          if (Array.isArray(parsed) && parsed.length > 0) {
            aiSkills = parsed.map(s => ({
              name: s.name,
              category: String(s.category || 'BACKEND').toUpperCase(),
              isRequired: Boolean(s.isRequired),
              minimumScore: Math.min(95, Math.max(50, Number(s.minimumScore) || 70))
            }));
            break;
          }
        }
      } catch (e) {
        // Continue to fallback
      }
    }
  }

  if (aiSkills && aiSkills.length > 0) {
    return aiSkills;
  }

  // Comprehensive Smart Tech Dictionary Fallback
  const dictionary = [
    // Frontend
    { name: 'React', category: 'FRONTEND', regex: /\b(react|react\.js|reactjs)\b/i, isRequired: true, minScore: 75 },
    { name: 'Next.js', category: 'FRONTEND', regex: /\b(next\.js|nextjs|next 14|next 15)\b/i, isRequired: true, minScore: 75 },
    { name: 'TypeScript', category: 'FRONTEND', regex: /\b(typescript|ts)\b/i, isRequired: true, minScore: 70 },
    { name: 'JavaScript', category: 'FRONTEND', regex: /\b(javascript|js|es6)\b/i, isRequired: true, minScore: 70 },
    { name: 'Vue.js', category: 'FRONTEND', regex: /\b(vue|vue\.js|vuejs|nuxt)\b/i, isRequired: true, minScore: 70 },
    { name: 'Tailwind CSS', category: 'FRONTEND', regex: /\b(tailwind|tailwindcss)\b/i, isRequired: false, minScore: 65 },
    { name: 'HTML5', category: 'FRONTEND', regex: /\b(html|html5)\b/i, isRequired: true, minScore: 70 },
    { name: 'CSS3', category: 'FRONTEND', regex: /\b(css|css3|sass|scss)\b/i, isRequired: true, minScore: 70 },

    // Backend
    { name: 'Node.js', category: 'BACKEND', regex: /\b(node|node\.js|nodejs)\b/i, isRequired: true, minScore: 70 },
    { name: 'NestJS', category: 'BACKEND', regex: /\b(nest\.js|nestjs)\b/i, isRequired: true, minScore: 75 },
    { name: 'Python', category: 'BACKEND', regex: /\b(python|django|fastapi|flask)\b/i, isRequired: true, minScore: 70 },
    { name: 'Go', category: 'BACKEND', regex: /\b(golang|go language|\bgo\b)\b/i, isRequired: true, minScore: 70 },
    { name: 'Java', category: 'BACKEND', regex: /\b(java|spring boot|spring)\b/i, isRequired: true, minScore: 70 },
    { name: 'C#', category: 'BACKEND', regex: /\b(c#|\.net|dotnet)\b/i, isRequired: true, minScore: 70 },
    { name: 'PHP', category: 'BACKEND', regex: /\b(php|laravel)\b/i, isRequired: true, minScore: 65 },

    // Database
    { name: 'PostgreSQL', category: 'DATABASE', regex: /\b(postgres|postgresql)\b/i, isRequired: true, minScore: 70 },
    { name: 'MySQL', category: 'DATABASE', regex: /\b(mysql)\b/i, isRequired: true, minScore: 70 },
    { name: 'MongoDB', category: 'DATABASE', regex: /\b(mongo|mongodb)\b/i, isRequired: false, minScore: 65 },
    { name: 'Redis', category: 'DATABASE', regex: /\b(redis|cache)\b/i, isRequired: false, minScore: 65 },
    { name: 'SQL', category: 'DATABASE', regex: /\b(sql|database|rdbms)\b/i, isRequired: true, minScore: 70 },

    // Testing / QA
    { name: 'Postman', category: 'TESTING', regex: /\b(postman|api test|api testing)\b/i, isRequired: true, minScore: 75 },
    { name: 'Selenium', category: 'TESTING', regex: /\b(selenium)\b/i, isRequired: false, minScore: 65 },
    { name: 'Playwright', category: 'TESTING', regex: /\b(playwright)\b/i, isRequired: false, minScore: 65 },
    { name: 'Cypress', category: 'TESTING', regex: /\b(cypress)\b/i, isRequired: false, minScore: 65 },
    { name: 'Automated Testing', category: 'TESTING', regex: /\b(automated test|automation test|e2e test)\b/i, isRequired: true, minScore: 70 },
    { name: 'Manual Testing', category: 'TESTING', regex: /\b(manual test|test case|test scenario)\b/i, isRequired: true, minScore: 70 },

    // DevOps & Cloud
    { name: 'Docker', category: 'DEVOPS', regex: /\b(docker|container|containers)\b/i, isRequired: true, minScore: 65 },
    { name: 'Kubernetes', category: 'DEVOPS', regex: /\b(kubernetes|k8s)\b/i, isRequired: false, minScore: 65 },
    { name: 'AWS', category: 'DEVOPS', regex: /\b(aws|amazon web services)\b/i, isRequired: false, minScore: 65 },
    { name: 'Git', category: 'DEVOPS', regex: /\b(git|github|gitlab)\b/i, isRequired: true, minScore: 70 },
    { name: 'CI/CD', category: 'DEVOPS', regex: /\b(ci\/cd|pipeline|github actions)\b/i, isRequired: false, minScore: 65 },
  ];

  const matched = [];
  for (const r of dictionary) {
    if (r.regex.test(combined)) {
      matched.push({ name: r.name, category: r.category, isRequired: r.isRequired, minimumScore: r.minScore });
    }
  }

  // Fallback defaults if none matched
  if (matched.length === 0) {
    if (/qa|test|quality/i.test(title)) {
      matched.push({ name: 'Postman', category: 'TESTING', isRequired: true, minimumScore: 75 });
      matched.push({ name: 'Automated Testing', category: 'TESTING', isRequired: true, minimumScore: 70 });
      matched.push({ name: 'PostgreSQL', category: 'DATABASE', isRequired: false, minimumScore: 65 });
    } else if (/frontend|client|ui/i.test(title)) {
      matched.push({ name: 'React', category: 'FRONTEND', isRequired: true, minimumScore: 75 });
      matched.push({ name: 'TypeScript', category: 'FRONTEND', isRequired: true, minimumScore: 70 });
      matched.push({ name: 'Tailwind CSS', category: 'FRONTEND', isRequired: false, minimumScore: 65 });
    } else {
      matched.push({ name: 'Node.js', category: 'BACKEND', isRequired: true, minimumScore: 70 });
      matched.push({ name: 'PostgreSQL', category: 'DATABASE', isRequired: true, minimumScore: 65 });
      matched.push({ name: 'Docker', category: 'DEVOPS', isRequired: false, minimumScore: 65 });
    }
  }

  return matched;
}

// Helper: Sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('🚀 Starting Comprehensive Job Details & AI Skill Enrichment for ALL jobs...\n');
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${jobs.length} total jobs to process.\n`);
  let updatedCount = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const prefix = `[${i + 1}/${jobs.length}]`;
    console.log(`${prefix} Processing: "${job.title}" (${job.source})`);

    let deep = null;
    if (job.source === 'JOBTHAI' && job.sourceUrl) {
      deep = cleanJobThai(job.sourceUrl);
    } else if (job.source === 'JOBSDB' && job.sourceUrl) {
      deep = cleanJobsDB(job.sourceUrl);
    }

    let finalDesc = job.description;
    let finalReq = job.requirements || '';
    let finalCompany = job.companyName;
    let finalLogo = job.companyLogoUrl;
    let finalBenefits = job.benefits;

    if (deep) {
      if (deep.description) finalDesc = deep.description;
      if (deep.requirements) finalReq = deep.requirements;
      if (deep.companyName) finalCompany = deep.companyName;
      if (deep.companyLogoUrl) finalLogo = deep.companyLogoUrl;
      if (deep.benefits) finalBenefits = deep.benefits;
    } else {
      const normalized = normalizeGenericText(job.description, job.requirements);
      finalDesc = normalized.description;
      finalReq = normalized.requirements;
    }

    // Ensure description has "- " lines and requirements has "1. ", "2. " lines
    const finalDescBullets = splitToBullets(finalDesc).join('\n') || `- ${finalDesc}`;
    const finalReqNumbers = splitToNumbered(finalReq).join('\n') || `1. ${finalReq}`;

    // 1. Update Job record in DB
    await prisma.job.update({
      where: { id: job.id },
      data: {
        companyName: finalCompany,
        companyLogoUrl: finalLogo,
        description: finalDescBullets,
        requirements: finalReqNumbers,
        benefits: finalBenefits,
      },
    });

    // 2. Extract and assign skills with AI / Engine
    const extractedSkills = await extractSkills(job.title, finalDescBullets, finalReqNumbers);

    for (const item of extractedSkills) {
      let skill = await prisma.skill.findFirst({
        where: { name: { equals: item.name, mode: 'insensitive' } },
      });

      if (!skill) {
        skill = await prisma.skill.create({
          data: {
            name: item.name,
            slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            category: item.category,
            description: `Proficiency with ${item.name} in modern software engineering.`,
          },
        });
      }

      await prisma.jobSkill.upsert({
        where: { jobId_skillId: { jobId: job.id, skillId: skill.id } },
        create: {
          jobId: job.id,
          skillId: skill.id,
          isRequired: item.isRequired,
          weight: item.isRequired ? 1.0 : 0.6,
          minimumScore: item.minimumScore || 70,
        },
        update: {
          isRequired: item.isRequired,
          minimumScore: item.minimumScore || 70,
        },
      });
    }

    updatedCount++;
    console.log(`   -> Updated. Company: "${finalCompany}". Skills: ${extractedSkills.map(s => s.name).join(', ')}`);

    // Friendly delay to avoid hitting rate limits
    await sleep(800);
  }

  console.log(`\n🎉 ALL DONE! Successfully processed and enriched all ${updatedCount} jobs!`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Batch failed:', err);
  process.exit(1);
});
