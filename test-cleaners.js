const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const cheerio = require('cheerio');
require('dotenv').config();

const prisma = new PrismaClient();

function cleanJobThai(url) {
  try {
    const html = execSync(`curl.exe -s -L "${url}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"`, { maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' });
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
    return {
      companyName: jp.hiringOrganization?.name,
      companyLogoUrl: jp.hiringOrganization?.logo,
      description: jp.description ? jp.description.replace(/\\n/g, '\n').trim() : null,
      requirements: jp.qualifications ? jp.qualifications.replace(/\\n/g, '\n').trim() : null,
      benefits: jp.jobBenefits || null,
    };
  } catch (e) {
    return null;
  }
}

function cleanJobsDB(url) {
  try {
    const html = execSync(`curl.exe -s -L "${url}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"`, { maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' });
    const reduxMatch = html.match(/window\.SEEK_REDUX_DATA\s*=\s*(\{.*?\});/s);
    if (!reduxMatch) return null;
    const data = JSON.parse(reduxMatch[1]);
    const job = data?.jobdetails?.result?.job;
    if (!job || !job.content) return null;
    const $ = cheerio.load(job.content);
    
    // Extract list items or paragraphs
    const bullets = [];
    $('li, p').each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 10 && t.length < 400 && !bullets.includes(t)) {
        bullets.push(t);
      }
    });

    const half = Math.floor(bullets.length / 2);
    const descItems = bullets.slice(0, Math.max(3, half));
    const reqItems = bullets.slice(Math.max(3, half));

    return {
      companyName: job.advertiser?.description,
      description: descItems.map(b => `- ${b.replace(/^[-•*]\s*/, '')}`).join('\n'),
      requirements: reqItems.map((b, i) => `${i + 1}. ${b.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•*]\s*/, '')}`).join('\n'),
    };
  } catch (e) {
    return null;
  }
}

async function run() {
  console.log('Testing deep extraction functions...');
  const resThai = cleanJobThai('https://www.jobthai.com/th/company/job/1942827');
  console.log('JobThai result:', resThai ? 'Found ' + resThai.companyName : 'Failed');
  
  const resJobsDB = cleanJobsDB('https://th.jobsdb.com/job/94619751');
  console.log('JobsDB result:', resJobsDB ? 'Found ' + resJobsDB.description?.slice(0, 100) : 'Failed');
  
  await prisma.$disconnect();
}

run();
