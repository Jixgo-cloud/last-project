import * as cheerio from 'cheerio';
import axios from 'axios';
import { fetchPublicJobHttp2 } from './public-job-http2';

export function jobText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const $ = cheerio.load(value.replace(/<(br|\/p|\/li|\/div|\/h[1-6])\b[^>]*>/gi, '\n'));
  $('script,style').remove();
  return $.text().replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
}

export function jobSections(description: string) {
  const sections: Record<string, string> = {};
  const lines = description.split('\n');
  let current = '';
  for (const line of lines) {
    const heading = line.trim().replace(/^\*\*|\*\*$/g, '').replace(/[:：]$/, '');
    if (/^(qualifications|requirements|what you(['’]ll| will) need(?: to succeed)?|what you bring|คุณสมบัติ(?:ผู้สมัคร)?|คุณสมบัติที่ต้องการ)$/i.test(heading)) current = 'requirements';
    else if (/^(benefits|what we offer|สวัสดิการ|สิ่งที่คุณจะได้รับ)$/i.test(heading)) current = 'benefits';
    else if (/^(responsibilities|about us|หน้าที่.*|วิธีการสมัคร|ติดต่อ|สถานที่ปฏิบัติงาน)$/i.test(heading)) current = '';
    else if (current) sections[current] = ((sections[current] || '') + '\n' + line).trim();
  }
  return sections;
}

// Only explicitly monthly salaries fit the application's monthly salary fields.
export function monthlySalary(value: any) {
  const q = value?.value || value;
  if (!q || String(q.unitText).toUpperCase() !== 'MONTH') return {};
  const numeric = (n: unknown) => typeof n === 'string' && /^\d+(\.\d+)?$/.test(n) ? Number(n) : n;
  const min = numeric(q.minValue ?? q.value), max = numeric(q.maxValue ?? q.value);
  if (![min, max].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) || min > max) return {};
  // Blognone uses zero/zero for salary not disclosed.
  if (min === 0 && max === 0) return {};
  return { salaryMin: min, salaryMax: max, salaryCurrency: value.currency || 'THB' };
}

export function parseJobDetail(html: string, url: string): Record<string, any> {
  const $ = cheerio.load(html);
  const postings: any[] = [];
  const inspect = (obj: any, depth = 0) => {
    if (depth > 8 || !obj) return;
    if (typeof obj === 'string') { try { inspect(JSON.parse(obj), depth + 1); } catch {} return; }
    if (Array.isArray(obj)) { obj.forEach(x => inspect(x, depth + 1)); return; }
    if (typeof obj !== 'object') return;
    if (obj['@type'] === 'JobPosting' && !postings.some(p => JSON.stringify(p) === JSON.stringify(obj))) postings.push(obj);
    if (obj['@graph']) inspect(obj['@graph'], depth + 1);
    if (obj.type === 'application/ld+json') inspect(obj.children, depth + 1);
  };
  $('script').each((_i, el) => {
    const text = $(el).text();
    if ($(el).attr('type') === 'application/ld+json') inspect(text);
    // Parse Next.js serialized data as JSON; never execute source scripts.
    const match = text.match(/\.push\((\[[\s\S]*\])\);?\s*$/);
    if (match) { try { inspect(JSON.parse(match[1])); } catch {} }
  });
  const canonical = (v: string) => { try { const u = new URL(v, url); return u.origin + u.pathname.replace(/\/$/, ''); } catch { return ''; } };
  const exact = postings.filter(p => p.url && canonical(p.url) === canonical(url));
  const p = exact[0] || (postings.length === 1 && !postings[0].url ? postings[0] : null);
  let result: Record<string, any> = {};
  if (p) {
    const locations = Array.isArray(p.jobLocation) ? p.jobLocation : [p.jobLocation];
    const location = locations.map((l: any) => {
      const a = l?.address; return typeof a === 'string' ? a : [a?.addressLocality, a?.addressRegion, typeof a?.addressCountry === 'string' ? a.addressCountry : a?.addressCountry?.name].filter(Boolean).join(', ');
    }).filter(Boolean).join(' / ');
    result = { description: jobText(p.description), requirements: jobText(p.qualifications), benefits: jobText(p.jobBenefits), location,
      logoUrl: typeof p.hiringOrganization?.logo === 'string' ? p.hiringOrganization.logo : p.hiringOrganization?.logo?.url,
      ...monthlySalary(p.baseSalary) };
  }
  if (new URL(url).hostname === 'th.jobsdb.com') {
    const desc = $('[data-automation="jobAdDetails"]').first();
    if (desc.length) result.description = jobText(desc.html());
    result.location ||= $('[data-automation="job-detail-location"]').first().text().trim();
  }
  if (new URL(url).hostname === 'jobs.blognone.com') {
    const desc = $('.job-description, [itemprop="description"], .col-md-8.css-1wekrze').first();
    if (!result.description && desc.length) result.description = jobText(desc.html());
  }
  const visible = jobText($('body').html());
  if (/This job is no longer advertised|ตำแหน่งงานนี้หมดอายุแล้ว/.test(visible)) {
    result.isActive = false;
    if (!result.description) throw new Error('SOURCE_LISTING_CLOSED');
  }
  if (!result.description || result.description.length < 40) throw new Error('SOURCE_DETAIL_MISSING');
  const sections = jobSections(result.description);
  result.requirements ||= sections.requirements;
  result.benefits ||= sections.benefits;
  return Object.fromEntries(Object.entries(result).filter(([,v]) => v !== undefined && v !== null && v !== ''));
}

export async function fetchJobDetail(url: string) {
  const allowed = new Set(['www.jobthai.com', 'jobthai.com', 'th.jobsdb.com', 'jobs.blognone.com']);
  let target = new URL(url);
  for (let hop = 0; hop < 4; hop++) {
    if (target.protocol !== 'https:' || target.username || target.password || target.port || !allowed.has(target.hostname)) throw new Error('SOURCE_DETAIL_URL_DENIED');
    const response = await axios.get(target.href, { timeout: 15000, maxRedirects: 0, maxContentLength: 10 * 1024 * 1024,
      responseType: 'text', validateStatus: () => true, headers: { 'User-Agent': 'SmartCareer/1.0', Accept: 'text/html' } });
    if ([301,302,303,307,308].includes(response.status)) {
      const next = new URL(response.headers.location, target);
      if (next.hostname !== target.hostname) throw new Error('SOURCE_DETAIL_REDIRECT_DENIED');
      target = next; continue;
    }
    if (response.status === 403 && ['jobs.blognone.com', 'th.jobsdb.com'].includes(target.hostname)) {
      return parseJobDetail(await fetchPublicJobHttp2(target.href), target.href);
    }
    if (response.status !== 200) throw new Error(`SOURCE_HTTP_${response.status}`);
    return parseJobDetail(response.data, target.href);
  }
  throw new Error('SOURCE_DETAIL_REDIRECT_LIMIT');
}
