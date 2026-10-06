import axios from 'axios';
import { JobType } from '@smartcareer/shared';

// The anonymous getHome query published in Blognone's own frontend bundle.
// This is a read operation; no account token, cookies or relay is involved.
export const blognonePublicEndpoint = 'https://jobs-api.blognone.com/graphql';
export const blognonePublicQuery = `query getHome {
  home_jobs {
    slug title company { slug name_en } type province district
    salary_min salary_max salary_display_format
  }
}`;

export function parseBlognonePublicJobs(payload: any, limit: number) {
  const fail = (): never => { throw new Error('SOURCE_DATA_INVALID: ข้อมูลประกาศสาธารณะ Blognone ไม่ครบหรือรูปแบบเปลี่ยน รักษางานเดิมไว้'); };
  if (!Number.isInteger(limit) || limit < 1 || limit > 60 || (payload?.errors && (!Array.isArray(payload.errors) || payload.errors.length))) fail();
  const rows = payload?.data?.home_jobs;
  if (!Array.isArray(rows) || rows.length > 1000) fail();
  const types: Record<string, JobType> = {
    JOBTYPE_FULL_TIME: JobType.FULL_TIME, JOBTYPE_PART_TIME: JobType.PART_TIME,
    JOBTYPE_CONTRACT: JobType.CONTRACT, JOBTYPE_INTERNSHIP: JobType.INTERNSHIP,
  };
  const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0
    && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
  const slug = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value);
  const ids = new Set<string>();
  const jobs = rows.map((row: any) => {
    if (!slug(row?.slug) || !slug(row?.company?.slug) || !text(row?.title, 300)
      || !text(row?.company?.name_en, 300) || !Object.prototype.hasOwnProperty.call(types, row?.type)) fail();
    for (const field of ['province', 'district']) {
      if (row[field] != null && row[field] !== '' && !text(row[field], 200)) fail();
    }
    if (!['MIN_MAX', 'NOT_APPLICABLE', 'NEGOTIABLE'].includes(row.salary_display_format)) fail();
    for (const field of ['salary_min', 'salary_max']) {
      if (row[field] != null && (!Number.isSafeInteger(row[field]) || row[field] < 0 || row[field] > 100000000)) fail();
    }
    const visibleRange = row.salary_display_format === 'MIN_MAX';
    const salaryMin = visibleRange ? row.salary_min : null;
    const salaryMax = visibleRange ? row.salary_max : null;
    if (visibleRange && (salaryMin == null || salaryMax == null || salaryMin > salaryMax)) fail();
    if (ids.has(row.slug)) fail();
    ids.add(row.slug);
    const title = row.title.trim();
    return {
      id: row.slug, title: title.slice(0, 100), company: row.company.name_en.trim(),
      logoUrl: null, description: title,
      location: [row.district, row.province].filter(Boolean).join(', ') || 'ไม่ระบุสถานที่',
      isRemote: /\bremote\b|\bwfh\b/i.test(title), employmentType: types[row.type],
      salaryMin, salaryMax,
      url: `https://jobs.blognone.com/company/${row.company.slug}/job/${row.slug}`,
    };
  });
  return jobs.slice(0, limit);
}

export async function fetchBlognonePublicJobs(limit: number) {
  let payload: unknown;
  try {
    const response = await axios.post(blognonePublicEndpoint, { query: blognonePublicQuery }, {
      timeout: 12000, maxRedirects: 0, maxContentLength: 2 * 1024 * 1024,
      responseType: 'json',
      headers: { 'User-Agent': 'SmartCareer/1.0', Accept: 'application/json', 'Content-Type': 'application/json' },
    });
    payload = response.data;
  } catch (error: any) {
    const status = error.response?.status;
    throw new Error(status
      ? `SOURCE_HTTP_${status}: API สาธารณะ Blognone ไม่พร้อมให้อ่านข้อมูล รักษางานเดิมไว้`
      : 'SOURCE_CONNECTION_FAILED: ติดต่อ API สาธารณะ Blognone ไม่ได้ รักษางานเดิมไว้');
  }
  return parseBlognonePublicJobs(payload, limit);
}
