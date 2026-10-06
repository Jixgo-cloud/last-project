import { BadRequestException } from '@nestjs/common';
import { JobSource, JobType } from '@smartcareer/shared';

export function validateLocalJobBatch(input: unknown) {
  const fail = (): never => { throw new BadRequestException('ไฟล์งานไม่ถูกต้อง รองรับ JobsDB/Blognone ไม่เกิน 60 งาน และข้อมูลย้อนหลังไม่เกิน 7 วัน'); };
  const record = (value: any, keys: string[]) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => keys.includes(key));
  const batch = input as any;
  if (!record(batch, ['version', 'source', 'collectedAt', 'jobs']) || batch.version !== 1
    || ![JobSource.JOBSDB, JobSource.BLOGNONE].includes(batch.source)
    || typeof batch.collectedAt !== 'string' || !Array.isArray(batch.jobs)
    || batch.jobs.length < 1 || batch.jobs.length > 60 || Buffer.byteLength(JSON.stringify(batch)) > 256 * 1024) fail();
  if (batch.source === JobSource.BLOGNONE && batch.jobs.length > 30) fail();
  const time = Date.parse(batch.collectedAt);
  if (!Number.isFinite(time) || time > Date.now() + 300000 || time < Date.now() - 7 * 86400000) fail();
  const ids = new Set<string>();
  const urls = new Set<string>();
  for (const job of batch.jobs) {
    if (!record(job, ['id', 'title', 'company', 'logoUrl', 'description', 'location', 'isRemote', 'employmentType', 'salaryMin', 'salaryMax', 'url', 'salaryCurrency'])) fail();
    for (const [key, max] of [['id', 300], ['title', 300], ['company', 300], ['description', 10000], ['location', 500]] as const) {
      if (typeof job[key] !== 'string' || !job[key].trim() || job[key].length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(job[key])) fail();
    }
    if (typeof job.isRemote !== 'boolean' || !Object.values(JobType).includes(job.employmentType)
      || job.logoUrl !== null || (job.salaryCurrency !== undefined && job.salaryCurrency !== 'THB')) fail();
    for (const key of ['salaryMin', 'salaryMax']) {
      if (job[key] !== null && (!Number.isSafeInteger(job[key]) || job[key] < 0 || job[key] > 100000000)) fail();
    }
    if (job.salaryMin !== null && job.salaryMax !== null && job.salaryMin > job.salaryMax) fail();
    let parsed: URL;
    try { parsed = new URL(job.url); } catch { fail(); }
    if (typeof job.url !== 'string' || job.url.length > 2000 || parsed!.protocol !== 'https:'
      || parsed!.username || parsed!.password || parsed!.port || parsed!.hash || parsed!.search) fail();
    if (batch.source === JobSource.JOBSDB) {
      const number = parsed!.pathname.match(/^\/job\/(\d+)$/)?.[1];
      if (parsed!.hostname !== 'th.jobsdb.com' || !number || job.id !== `jobsdb-${number}`) fail();
    } else {
      if (parsed!.hostname !== 'jobs.blognone.com' || !/^\/company\/[^/]+\/job\/[^/]+$/.test(parsed!.pathname)
        || job.id !== parsed!.pathname.replace(/^\/.*\/job\//, '').replace(/\//g, '-')) fail();
    }
    if (ids.has(job.id) || urls.has(job.url)) fail();
    ids.add(job.id); urls.add(job.url);
  }
  return batch as { version: number; source: JobSource; collectedAt: string; jobs: any[] };
}
