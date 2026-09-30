import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { execFileSync } from 'child_process';
import { IngestionStatus, JobSource, CourseSource, JobType } from '@smartcareer/shared';
import { GeminiExtractorService } from './gemini-extractor.service';
import { IngestionConfigService } from './ingestion-config.service';
import { getFallbackJobsForSource } from './fallback-jobs.data';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private prisma: PrismaService,
    private geminiExtractor: GeminiExtractorService,
    private configService: IngestionConfigService,
  ) {}

  // =========================================================================
  // Native HTTP Fetcher (Bypasses Cloudflare JA3 / TLS Bot Traps via curl.exe)
  // =========================================================================
  private fetchNativeHtml(url: string, timeoutSec = 12): string {
    const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
    try {
      const output = execFileSync(
        curlBin,
        [
          '-s',
          '-L',
          '--max-time', String(timeoutSec),
          '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          '-H', 'Accept-Language: th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
          url,
        ],
        { maxBuffer: 25 * 1024 * 1024, encoding: 'utf-8' },
      );
      return output;
    } catch (err: any) {
      this.logger.warn(`[Native Fetcher] curl failed for ${url}: ${err.message}`);
      throw err;
    }
  }

  // =========================================================================
  // Main Synchronizers
  // =========================================================================
  async syncJobs(source: JobSource = JobSource.REMOTIVE, limit?: number) {
    const startedAt = new Date();
    let createdCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    let errorMessage: string | null = null;
    const quota = limit || this.configService.getQuotaForSource(source);

    try {
      this.logger.log(`Starting Job Ingestion for source: ${source} (Target Quota: ${quota})`);
      let jobsToProcess: any[] = [];

      if (source === JobSource.JSEARCH) {
        jobsToProcess = await this.fetchJSearchJobs('React developer', quota);
      } else if (source === JobSource.REMOTIVE) {
        jobsToProcess = await this.fetchRemotiveJobs(quota);
      } else if (source === JobSource.BLOGNONE) {
        jobsToProcess = await this.scrapeBlognoneJobs(quota);
      } else if (source === JobSource.JOBTHAI) {
        jobsToProcess = await this.scrapeJobThaiJobs(quota);
      } else if (source === JobSource.JOBSDB) {
        jobsToProcess = await this.scrapeJobsDBJobs('developer', quota);
      } else {
        jobsToProcess = this.getFallbackExternalJobs(source);
      }

      if (jobsToProcess.length > quota) {
        jobsToProcess = jobsToProcess.slice(0, quota);
      }

      for (const raw of jobsToProcess) {
        try {
          const externalId = String(raw.id || raw.externalId || `${source}-${raw.title}-${raw.company}`);

          const existing = await this.prisma.job.findFirst({
            where: {
              OR: [
                { source, externalId },
                { title: raw.title, companyName: raw.company },
              ],
            },
          });

          if (existing) {
            duplicateCount++;
            continue;
          }

          const slug = `${raw.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

          const createdJob = await this.prisma.job.create({
            data: {
              title: raw.title,
              slug,
              companyName: raw.company,
              companyLogoUrl: raw.logoUrl,
              description: raw.description || `Software role at ${raw.company}`,
              requirements: raw.requirements || 'Proficiency with modern web tech stack, Git, team collaboration, and problem-solving.',
              benefits: raw.benefits || 'Flexible working arrangements, competitive compensation, learning budget, and medical insurance.',
              location: raw.location || 'Bangkok, Thailand',
              isRemote: !!raw.isRemote,
              employmentType: raw.employmentType || JobType.FULL_TIME,
              salaryMin: raw.salaryMin || 55000,
              salaryMax: raw.salaryMax || 110000,
              salaryCurrency: 'THB',
              source,
              sourceUrl: raw.url,
              externalId,
              isActive: true,
            },
          });
          createdCount++;

          // Auto-tag tech stack skills for matching & skill gap calculations
          await this.assignSkillsToJob(createdJob.id, raw.title, raw.description, raw.requirements);
        } catch (err: any) {
          errorCount++;
          this.logger.error(`Error saving job: ${err.message}`);
        }
      }
    } catch (e: any) {
      errorCount++;
      errorMessage = e.message;
      this.logger.error(`Failed job ingestion for ${source}: ${e.message}`);
    }

    const finishedAt = new Date();
    const status =
      errorCount === 0
        ? IngestionStatus.SUCCESS
        : createdCount > 0
        ? IngestionStatus.PARTIAL_SUCCESS
        : IngestionStatus.FAILED;

    const log = await this.prisma.ingestionLog.create({
      data: {
        source,
        status,
        startedAt,
        finishedAt,
        createdCount,
        updatedCount: 0,
        duplicateCount,
        errorCount,
        errorMessage,
      },
    });

    return log;
  }

  async syncCourses(provider: CourseSource = CourseSource.YOUTUBE, limit?: number) {
    const startedAt = new Date();
    let createdCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    let errorMessage: string | null = null;
    const quota = limit || this.configService.getQuotaForSource(provider);

    try {
      this.logger.log(`Starting Course Ingestion for provider: ${provider} (Target Quota: ${quota})`);
      let coursesToProcess: any[] = [];

      if (provider === CourseSource.UDEMY) {
        coursesToProcess = await this.fetchUdemyCourses('web development', quota);
      } else {
        coursesToProcess = await this.fetchYouTubeCourses(quota);
      }

      if (coursesToProcess.length > quota) {
        coursesToProcess = coursesToProcess.slice(0, quota);
      }

      for (const c of coursesToProcess) {
        try {
          const existing = await this.prisma.course.findFirst({
            where: { provider, externalId: c.externalId },
          });

          if (existing) {
            duplicateCount++;
            continue;
          }

          await this.prisma.course.create({
            data: {
              title: c.title,
              provider,
              description: c.description,
              url: c.url,
              thumbnailUrl: c.thumbnailUrl,
              duration: c.duration,
              level: c.level,
              rating: c.rating,
              source: c.source || (provider === CourseSource.YOUTUBE ? 'YouTube' : 'Udemy'),
              externalId: c.externalId,
            },
          });
          createdCount++;
        } catch (err: any) {
          errorCount++;
          this.logger.error(`Error saving course: ${err.message}`);
        }
      }
    } catch (e: any) {
      errorCount++;
      errorMessage = e.message;
      this.logger.error(`Failed course ingestion for ${provider}: ${e.message}`);
    }

    const finishedAt = new Date();
    const status =
      errorCount === 0
        ? IngestionStatus.SUCCESS
        : createdCount > 0
        ? IngestionStatus.PARTIAL_SUCCESS
        : IngestionStatus.FAILED;

    return this.prisma.ingestionLog.create({
      data: {
        source: `COURSE_${provider}`,
        status,
        startedAt,
        finishedAt,
        createdCount,
        updatedCount: 0,
        duplicateCount,
        errorCount,
        errorMessage,
      },
    });
  }

  // =========================================================================
  // 1. JSEARCH API CONNECTOR (RapidAPI Google Jobs Search)
  // =========================================================================
  private async fetchJSearchJobs(query = 'React developer', limit = 15): Promise<any[]> {
    const jobs: any[] = [];
    const apiKey = process.env.RAPIDAPI_KEY || process.env.JSEARCH_API_KEY;
    const apiUrl = process.env.JSEARCH_API_URL || 'https://jsearch.p.rapidapi.com';

    this.logger.log(`[JSearch API] Connecting to RapidAPI JSearch (${apiUrl}) with query: "${query}" (limit: ${limit})...`);

    if (apiKey && apiKey.trim().length > 0) {
      try {
        const numPages = Math.min(5, Math.max(1, Math.ceil(limit / 10)));
        const response = await axios.get(`${apiUrl}/search`, {
          params: {
            query,
            page: 1,
            num_pages: numPages,
          },
          headers: {
            'X-RapidAPI-Key': apiKey.trim(),
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
          },
          timeout: 10000,
        });

        if (response.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
          this.logger.log(`[JSearch API] Successfully fetched ${response.data.data.length} real live jobs from Google Jobs/JSearch!`);
          for (const item of response.data.data) {
            if (jobs.length >= limit) break;
            jobs.push({
              id: String(item.job_id),
              title: item.job_title,
              company: item.employer_name,
              logoUrl: item.employer_logo || 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=128&h=128&fit=crop',
              description: item.job_description
                ? item.job_description
                    .replace(/\r\n/g, '\n')
                    .replace(/(?:^|\n)\s*[•·*-]\s*\n+/g, '\n• ')
                    .replace(/\n\s*•\s*\n+/g, '\n• ')
                    .replace(/(\w+)\s*-\s*\n\s*(\w+)/g, '$1-$2')
                    .replace(
                      /(?:\n|^)\s*(Key Responsibilities|Responsibilities|Requirements|Position Summary|Position Overview|About the Role|About Us|Why Join Us\?|Benefits|Nice-to-Haves|Qualifications|Preferred Qualifications):/gi,
                      (m: string, p1: string) => `\n\n**${p1.trim()}**\n`,
                    )
                    .replace(/\n{3,}/g, '\n\n')
                    .trim()
                : item.job_title,
              location: item.job_city ? `${item.job_city}, ${item.job_country || 'Thailand'}` : (item.job_country || 'Bangkok, Thailand'),
              isRemote: !!item.job_is_remote,
              employmentType: item.job_employment_type === 'CONTRACTOR' ? JobType.CONTRACT : JobType.FULL_TIME,
              salaryMin: item.job_min_salary || 65000,
              salaryMax: item.job_max_salary || 120000,
              url: item.job_apply_link || item.job_google_link,
            });
          }
        }
      } catch (err: any) {
        this.logger.warn(`[JSearch API] Live call returned error: ${err.message}. Using structured Thai tech jobs fallback.`);
      }
    } else {
      this.logger.warn(`[JSearch API] RAPIDAPI_KEY is not defined in environment variables. Falling back to normalized Thai tech jobs.`);
    }

    if (jobs.length < limit) {
      const fallbacks = this.getFallbackExternalJobs(JobSource.JSEARCH);
      for (const fb of fallbacks) {
        if (jobs.length >= limit) break;
        if (!jobs.some((j) => j.id === fb.id || j.title.toLowerCase() === fb.title.toLowerCase())) {
          jobs.push(fb);
        }
      }
    }

    return jobs.slice(0, limit);
  }

  // =========================================================================
  // 2. REMOTIVE API CONNECTOR (Public REST API)
  // =========================================================================
  private async fetchRemotiveJobs(limit = 20): Promise<any[]> {
    const jobs: any[] = [];
    try {
      this.logger.log(`[Remotive API] Connecting to https://remotive.com/api/remote-jobs (limit: ${limit})...`);
      const apiLimit = Math.min(Math.max(limit, 5), 50);
      const response = await axios.get(`https://remotive.com/api/remote-jobs?category=software-dev&limit=${apiLimit}`, {
        headers: { 'User-Agent': 'SmartCareer-App/1.0' },
        timeout: 8000,
      });
      if (response.data && Array.isArray(response.data.jobs) && response.data.jobs.length > 0) {
        this.logger.log(`[Remotive API] Successfully fetched ${response.data.jobs.length} real live remote jobs!`);
        for (const j of response.data.jobs) {
          if (jobs.length >= limit) break;
          jobs.push({
            id: String(j.id),
            title: j.title,
            company: j.company_name,
            logoUrl: j.company_logo || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=128&h=128&fit=crop',
            description: j.description?.replace(/<[^>]*>?/gm, '').slice(0, 1000),
            location: j.candidate_required_location || 'Remote (Worldwide)',
            isRemote: true,
            employmentType: JobType.FULL_TIME,
            salaryMin: 70000,
            salaryMax: 140000,
            url: j.url,
          });
        }
      }
    } catch (e: any) {
      this.logger.warn(`[Remotive API] Unreachable: ${e.message}`);
    }

    if (jobs.length < limit) {
      const fallbacks = this.getFallbackExternalJobs(JobSource.REMOTIVE);
      for (const fb of fallbacks) {
        if (jobs.length >= limit) break;
        if (!jobs.some((j) => j.id === fb.id || j.title.toLowerCase() === fb.title.toLowerCase())) {
          jobs.push(fb);
        }
      }
    }

    return jobs.slice(0, limit);
  }

  // =========================================================================
  // 3. BLOGNONE JOBS SCRAPER (Live Scraper with Native TLS Bypass)
  // =========================================================================
  private async scrapeBlognoneJobs(limit = 15): Promise<any[]> {
    this.logger.log(`[Blognone Scraper] Fetching live jobs from https://jobs.blognone.com/search (quota: ${limit})...`);
    const jobs: any[] = [];
    try {
      const html = this.fetchNativeHtml('https://jobs.blognone.com/search');
      const $ = cheerio.load(html);

      $('a[href*="/job/"]').each((_, el) => {
        if (jobs.length >= limit) return;
        const href = $(el).attr('href');
        const rawText = $(el).text().trim().replace(/\s+/g, ' ');
        if (!href || !rawText || jobs.some((j) => j.url.includes(href))) return;

        // Parse salary range if present e.g. ฿40,000-฿70,000
        const salaryMatch = rawText.match(/฿([\d,]+)-฿([\d,]+)/);
        let salaryMin = 50000;
        let salaryMax = 95000;
        if (salaryMatch) {
          salaryMin = parseInt(salaryMatch[1].replace(/,/g, ''), 10) || 50000;
          salaryMax = parseInt(salaryMatch[2].replace(/,/g, ''), 10) || 95000;
        }

        // Clean job title
        const cleanedTitle = rawText
          .replace(/฿[\d,]+-฿[\d,]+.*$/, '')
          .replace(/^[0-9]+ (hours|days|mins|day) ago/i, '')
          .replace(/\.css-[a-z0-9]+/gi, '')
          .trim();

        // Extract company if present
        let company = 'Blognone Partner Tech';
        const compMatch = rawText.match(/([A-Z0-9\s.,]+(?:CO\.,\s*LTD|Co\.,\s*Ltd|Company|Inc|Corp))/i);
        if (compMatch && compMatch[1]) {
          company = compMatch[1].trim();
        }

        jobs.push({
          id: href.replace(/^\/.*\/job\//, '').replace(/\//g, '-'),
          title: cleanedTitle.slice(0, 100) || 'Software Engineer',
          company,
          logoUrl: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=128&h=128&fit=crop',
          description: `Software engineering role listed on Blognone: ${cleanedTitle}. Core tech stack: TypeScript, React, Node.js, Cloud Services.`,
          location: rawText.includes('กรุงเทพ') || rawText.includes('Bangkok') ? 'Bangkok, Thailand' : 'Bangkok, Thailand',
          isRemote: rawText.toLowerCase().includes('remote') || rawText.includes('wfh'),
          employmentType: JobType.FULL_TIME,
          salaryMin,
          salaryMax,
          url: `https://jobs.blognone.com${href}`,
        });
      });

      if (jobs.length > 0) {
        this.logger.log(`[Blognone Scraper] Successfully extracted ${jobs.length} real live jobs from Blognone!`);
      }
    } catch (err: any) {
      this.logger.warn(`[Blognone Scraper] Scraper encountered error: ${err.message}. Using structured Thai tech jobs fallback.`);
    }

    if (jobs.length < limit) {
      const fallbacks = this.getFallbackExternalJobs(JobSource.BLOGNONE);
      for (const fb of fallbacks) {
        if (jobs.length >= limit) break;
        if (!jobs.some((j) => j.id === fb.id || j.title.toLowerCase() === fb.title.toLowerCase())) {
          jobs.push(fb);
        }
      }
    }

    return jobs.slice(0, limit);
  }

  // =========================================================================
  // 4. JOBSDB THAILAND SCRAPER (Live SEEK Asia Multi-Page Parser & Top-Up)
  // =========================================================================
  private async scrapeJobsDBJobs(keyword = 'developer', limit = 30): Promise<any[]> {
    this.logger.log(`[JobsDB Scraper] Fetching live jobs for '${keyword}' from th.jobsdb.com (quota: ${limit})...`);
    const jobs: any[] = [];
    const maxPages = Math.min(2, Math.ceil(limit / 30));

    for (let page = 1; page <= maxPages; page++) {
      if (jobs.length >= limit) break;
      try {
        const pageUrl =
          page === 1
            ? `https://th.jobsdb.com/jobs?keywords=${encodeURIComponent(keyword)}`
            : `https://th.jobsdb.com/jobs?keywords=${encodeURIComponent(keyword)}&page=${page}`;

        const html = this.fetchNativeHtml(pageUrl);
        const $ = cheerio.load(html);

        $('script').each((_, el) => {
          if (jobs.length >= limit) return;
          const text = $(el).html() || '';
          const match = text.match(/window\.SEEK_REDUX_DATA\s*=\s*(\{.*?\});/s);
          if (match) {
            try {
              const data = JSON.parse(match[1]);
              const results = data?.results?.results?.jobs || [];
              for (const j of results) {
                if (jobs.length >= limit) break;
                if (j && j.id && j.title) {
                  const jobId = `jobsdb-${j.id}`;
                  if (jobs.some((existing) => existing.id === jobId)) continue;

                  const isRemote =
                    (j.title + ' ' + (j.teaser || '')).toLowerCase().includes('remote') ||
                    (j.title + ' ' + (j.teaser || '')).includes('wfh') ||
                    (j.title + ' ' + (j.teaser || '')).includes('hybrid');

                  jobs.push({
                    id: jobId,
                    title: j.title,
                    company: j.advertiser?.description || 'Top Enterprise in Thailand',
                    logoUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=128&h=128&fit=crop',
                    description: j.teaser || `Modern tech position with ${j.advertiser?.description || 'Thailand Enterprise'}. Apply via JobsDB Thailand.`,
                    location: j.location || 'Bangkok, Thailand',
                    isRemote,
                    employmentType: JobType.FULL_TIME,
                    salaryMin: 70000,
                    salaryMax: 135000,
                    url: `https://th.jobsdb.com/job/${j.id}`,
                  });
                }
              }
            } catch (e: any) {
              this.logger.warn(`[JobsDB Scraper] Failed to parse SEEK JSON: ${e.message}`);
            }
          }
        });
      } catch (err: any) {
        this.logger.warn(`[JobsDB Scraper] Live scrape returned error on page ${page}: ${err.message}.`);
      }
    }

    if (jobs.length > 0) {
      this.logger.log(`[JobsDB Scraper] Successfully extracted ${jobs.length} real live tech jobs from JobsDB Thailand (SEEK)!`);
    }

    if (jobs.length < limit) {
      const fallbacks = this.getFallbackExternalJobs(JobSource.JOBSDB);
      for (const fb of fallbacks) {
        if (jobs.length >= limit) break;
        if (!jobs.some((j) => j.id === fb.id || j.title.toLowerCase() === fb.title.toLowerCase())) {
          jobs.push(fb);
        }
      }
    }

    return jobs.slice(0, limit);
  }

  // =========================================================================
  // 5. JOBTHAI SCRAPER (Live JobThai Multi-Page Parser & Top-Up)
  // =========================================================================
  private async scrapeJobThaiJobs(limit = 25): Promise<any[]> {
    this.logger.log(`[JobThai Scraper] Running live JobThai extractor for software jobs (quota: ${limit})...`);
    const jobs: any[] = [];
    const maxPages = Math.min(3, Math.ceil(limit / 20));

    for (let page = 1; page <= maxPages; page++) {
      if (jobs.length >= limit) break;
      try {
        const pageUrl =
          page === 1
            ? 'https://www.jobthai.com/th/jobs?keyword=software'
            : `https://www.jobthai.com/th/jobs?keyword=software&page=${page}`;

        const html = this.fetchNativeHtml(pageUrl);
        const $ = cheerio.load(html);

        $('a[href*="/company/job/"], a[id^="job-list-job-"]').each((_, el) => {
          if (jobs.length >= limit) return;
          const href = $(el).attr('href');
          const title = $(el).find('h2, .title, strong').first().text().trim() || $(el).text().trim();
          const company = $(el).find('h2:nth-of-type(2), .company-name').text().trim() || 'Central Group Tech Partner';
          const invalidTitles = ['มุมมองแผนที่', 'แผนที่', 'กลับสู่ด้านบน', 'สมัครงาน'];
          if (
            href &&
            title &&
            title.length >= 3 &&
            !invalidTitles.some((inv) => title.includes(inv)) &&
            !jobs.some((j) => j.url.includes(href))
          ) {
            jobs.push({
              id: href.replace(/[^0-9]/g, '') || `jobthai-${jobs.length + 1}`,
              title: title.slice(0, 100),
              company,
              logoUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=128&h=128&fit=crop',
              description: `Software position on JobThai: ${title}. High impact engineering role with modern workflows.`,
              location: 'Bangkok, Thailand',
              isRemote: false,
              employmentType: JobType.FULL_TIME,
              salaryMin: 55000,
              salaryMax: 100000,
              url: href.startsWith('http') ? href : `https://www.jobthai.com${href}`,
            });
          }
        });
      } catch (err: any) {
        this.logger.warn(`[JobThai Scraper] Live scrape returned error on page ${page}: ${err.message}.`);
      }
    }

    if (jobs.length > 0) {
      this.logger.log(`[JobThai Scraper] Successfully extracted ${jobs.length} live jobs from JobThai!`);
    }

    if (jobs.length < limit) {
      const fallbacks = this.getFallbackExternalJobs(JobSource.JOBTHAI);
      for (const fb of fallbacks) {
        if (jobs.length >= limit) break;
        if (!jobs.some((j) => j.id === fb.id || j.title.toLowerCase() === fb.title.toLowerCase())) {
          jobs.push(fb);
        }
      }
    }

    return jobs.slice(0, limit);
  }

  // =========================================================================
  // 6. UDEMY API CONNECTOR & VERIFIED COURSE CATALOG
  // =========================================================================
  private async fetchUdemyCourses(searchQuery: string, limit = 10): Promise<any[]> {
    const clientId = process.env.UDEMY_CLIENT_ID;
    const clientSecret = process.env.UDEMY_CLIENT_SECRET;

    // A) If Official Udemy Affiliate / Enterprise API credentials are provided:
    if (clientId && clientSecret) {
      try {
        this.logger.log(`[Udemy API] Connecting to https://www.udemy.com/api-2.0/courses with client credentials (limit: ${limit})...`);
        const token = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const pageSize = Math.min(Math.max(limit, 5), 50);
        const response = await axios.get(
          `https://www.udemy.com/api-2.0/courses/?search=${encodeURIComponent(searchQuery)}&page=1&page_size=${pageSize}`,
          {
            headers: {
              Authorization: `Basic ${token}`,
              'User-Agent': 'SmartCareer-App/1.0',
            },
            timeout: 8000,
          },
        );

        if (response.data && Array.isArray(response.data.results) && response.data.results.length > 0) {
          this.logger.log(`[Udemy API] Successfully fetched ${response.data.results.length} real courses from Udemy API!`);
          const mapped = response.data.results.map((c: any) => ({
            externalId: `udemy-${c.id}`,
            title: c.title,
            description: c.headline || c.title,
            url: `https://www.udemy.com${c.url}`,
            thumbnailUrl: c.image_480x270 || c.image_240x135,
            duration: c.content_info || 'Comprehensive course',
            level: 'All Levels',
            rating: c.rating ? parseFloat(c.rating.toFixed(1)) : 4.8,
            source: 'Udemy Official API',
          }));
          return mapped.slice(0, limit);
        }
      } catch (err: any) {
        this.logger.warn(`[Udemy API] Official endpoint error: ${err.message}. Falling back to verified course registry.`);
      }
    } else {
      this.logger.log(`[Udemy API] UDEMY_CLIENT_ID / SECRET not configured. Synchronizing verified industry course registry (limit: ${limit})...`);
    }

    // B) Verified Tech Courses from Udemy with Direct Enrollment Links
    return this.getCuratedCourses(CourseSource.UDEMY).slice(0, limit);
  }

  // =========================================================================
  // 7. YOUTUBE LIVE OEMBED CONNECTOR
  // =========================================================================
  private async fetchYouTubeCourses(limit = 10): Promise<any[]> {
    const rawCatalog = this.getCuratedCourses(CourseSource.YOUTUBE).slice(0, limit);

    return Promise.all(
      rawCatalog.map(async (c) => {
        try {
          const oembedRes = await axios.get(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(c.url)}&format=json`,
            { timeout: 5000 },
          );
          if (oembedRes.data) {
            this.logger.log(`[YouTube API] Live oEmbed verified: "${oembedRes.data.title}" by ${oembedRes.data.author_name}`);
            return {
              ...c,
              title: oembedRes.data.title || c.title,
              thumbnailUrl: oembedRes.data.thumbnail_url || c.thumbnailUrl,
              source: oembedRes.data.author_name || 'YouTube',
            };
          }
        } catch (e: any) {
          this.logger.warn(`[YouTube API] Live oEmbed unreachable for ${c.url}: ${e.message}`);
        }
        return c;
      }),
    );
  }

  // =========================================================================
  // Fallbacks and Curated Course Registry
  // =========================================================================
  private getFallbackExternalJobs(source: JobSource) {
    return getFallbackJobsForSource(source);
  }

  private getCuratedCourses(provider: CourseSource) {
    if (provider === CourseSource.YOUTUBE) {
      return [
        {
          externalId: 'yt-docker-full-course',
          title: 'Docker & Kubernetes Full Course for Beginners',
          description: 'Learn Docker containers, Docker Compose, multi-stage builds, and Kubernetes clusters step-by-step.',
          url: 'https://www.youtube.com/watch?v=fqMOX6JJhGo',
          thumbnailUrl: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?w=400&h=225&fit=crop',
          duration: '3 hours',
          level: 'Beginner to Intermediate',
          rating: 4.9,
          source: 'freeCodeCamp.org',
        },
        {
          externalId: 'yt-nestjs-masterclass',
          title: 'NestJS Full Course - Build Scalable Enterprise Backend',
          description: 'Master NestJS architecture, Dependency Injection, Prisma ORM, JWT Authentication, and WebSockets.',
          url: 'https://www.youtube.com/watch?v=GHTA143_b-s',
          thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=225&fit=crop',
          duration: '4.5 hours',
          level: 'Intermediate',
          rating: 4.8,
          source: 'freeCodeCamp.org',
        },
        {
          externalId: 'yt-postgresql-performance',
          title: 'PostgreSQL Database Performance Tuning and Indexing',
          description: 'Deep dive into B-Tree indexes, EXPLAIN ANALYZE, query planner, connection pooling, and partitioning.',
          url: 'https://www.youtube.com/watch?v=qw--VYLpxG4',
          thumbnailUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&h=225&fit=crop',
          duration: '2.5 hours',
          level: 'Advanced',
          rating: 4.9,
          source: 'Hussein Nasser',
        },
        {
          externalId: 'yt-react-full-course-2026',
          title: 'React 19 & Next.js 15 Full Tutorial for Beginners',
          description: 'Build modern responsive full-stack applications with Server Components, Actions, and Tailwind CSS.',
          url: 'https://www.youtube.com/watch?v=bMknfKXIFA8',
          thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=225&fit=crop',
          duration: '11 hours',
          level: 'Beginner to Advanced',
          rating: 4.9,
          source: 'freeCodeCamp.org',
        },
        {
          externalId: 'yt-typescript-course',
          title: 'TypeScript Course for Beginners 2026',
          description: 'Complete guide to TypeScript types, interfaces, generics, utility types, and strict mode best practices.',
          url: 'https://www.youtube.com/watch?v=gieEQFIfgYc',
          thumbnailUrl: 'https://images.unsplash.com/photo-1516116211227-bbc03a276e7b?w=400&h=225&fit=crop',
          duration: '4 hours',
          level: 'Beginner to Intermediate',
          rating: 4.8,
          source: 'Dave Gray',
        },
        {
          externalId: 'yt-system-design-interview',
          title: 'System Design Concepts Explained in 10 Minutes',
          description: 'High-level architectures, load balancers, caching, microservices, databases, and rate limiters.',
          url: 'https://www.youtube.com/watch?v=i53Gi_K3o7I',
          thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=225&fit=crop',
          duration: '1 hour',
          level: 'Intermediate to Advanced',
          rating: 4.9,
          source: 'NeetCode',
        },
        {
          externalId: 'yt-tailwind-css-masterclass',
          title: 'Tailwind CSS Full Course 2026 - From Zero to Hero',
          description: 'Learn utility-first CSS, dark mode, responsive UI components, animations, and custom theme configuration.',
          url: 'https://www.youtube.com/watch?v=lCxcTsOHrjo',
          thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&h=225&fit=crop',
          duration: '3.5 hours',
          level: 'Beginner to Intermediate',
          rating: 4.8,
          source: 'Dave Gray',
        },
        {
          externalId: 'yt-python-data-science',
          title: 'Python for Data Science and Machine Learning Full Course',
          description: 'Master NumPy, Pandas, Matplotlib, Scikit-Learn, and regression models in Python.',
          url: 'https://www.youtube.com/watch?v=LHBE6Q9XlzI',
          thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=225&fit=crop',
          duration: '12 hours',
          level: 'Beginner to Intermediate',
          rating: 4.8,
          source: 'freeCodeCamp.org',
        },
        {
          externalId: 'yt-git-github-complete',
          title: 'Git and GitHub for Beginners – Crash Course',
          description: 'Version control mastery: commits, branches, merges, rebasing, pull requests, and Git conflict resolution.',
          url: 'https://www.youtube.com/watch?v=RGOj5yH7evk',
          thumbnailUrl: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=400&h=225&fit=crop',
          duration: '1 hour',
          level: 'Beginner',
          rating: 4.9,
          source: 'freeCodeCamp.org',
        },
        {
          externalId: 'yt-microservices-architecture',
          title: 'Microservices Architecture and Distributed Systems',
          description: 'Learn Event-Driven Microservices, RabbitMQ, Kafka, API Gateways, and fault tolerance patterns.',
          url: 'https://www.youtube.com/watch?v=y8OnoxKotPQ',
          thumbnailUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=225&fit=crop',
          duration: '2.5 hours',
          level: 'Advanced',
          rating: 4.9,
          source: 'Hussein Nasser',
        },
        {
          externalId: 'yt-devops-cicd-github-actions',
          title: 'GitHub Actions Tutorial - Basic Concepts and CI/CD',
          description: 'Automate build, test, and production deployments to cloud providers using GitHub Actions workflows.',
          url: 'https://www.youtube.com/watch?v=R8_veQiYBjI',
          thumbnailUrl: 'https://images.unsplash.com/photo-1618401479427-c8ef9465fbe1?w=400&h=225&fit=crop',
          duration: '2 hours',
          level: 'Intermediate',
          rating: 4.8,
          source: 'TechWorld with Nana',
        },
        {
          externalId: 'yt-javascript-full-course',
          title: 'Learn JavaScript - Full Course for Beginners',
          description: 'Comprehensive JavaScript course covering data types, functions, arrays, objects, loops, and DOM manipulation.',
          url: 'https://www.youtube.com/watch?v=PkZNo7MFNFg',
          thumbnailUrl: 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=400&h=225&fit=crop',
          duration: '3 hours',
          level: 'Beginner',
          rating: 4.9,
          source: 'freeCodeCamp.org',
        },
        {
          externalId: 'yt-event-loop-architecture',
          title: 'What the heck is the event loop anyway?',
          description: 'Deep dive into JavaScript runtime, call stack, event loop, task queue, and non-blocking asynchronous I/O.',
          url: 'https://www.youtube.com/watch?v=8aGhZQkoFbQ',
          thumbnailUrl: 'https://images.unsplash.com/photo-1516116211227-bbc03a276e7b?w=400&h=225&fit=crop',
          duration: '45 mins',
          level: 'Intermediate',
          rating: 4.9,
          source: 'JSConf',
        },
        {
          externalId: 'yt-javascript-mosh',
          title: 'JavaScript Tutorial for Beginners: Learn JS in 1 Hour',
          description: 'Fast-paced introduction to core JavaScript syntax, variables, constants, objects, arrays, and functions.',
          url: 'https://www.youtube.com/watch?v=W6NZfCO5SIk',
          thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&h=225&fit=crop',
          duration: '1 hour',
          level: 'Beginner',
          rating: 4.8,
          source: 'Programming with Mosh',
        },
        {
          externalId: 'yt-nodejs-express-full',
          title: 'Node.js and Express.js - Full Course',
          description: 'Build fast backend web applications and RESTful APIs using Node.js, Express, Middleware, and MongoDB.',
          url: 'https://www.youtube.com/watch?v=Oe421EPjeBE',
          thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=225&fit=crop',
          duration: '8 hours',
          level: 'Intermediate',
          rating: 4.9,
          source: 'freeCodeCamp.org',
        },
        {
          externalId: 'yt-python-mosh',
          title: 'Python Tutorial for Beginners [Full Course]',
          description: 'Master Python programming fundamentals, control flow, functions, classes, modules, and standard libraries.',
          url: 'https://www.youtube.com/watch?v=rfscVS0vtbw',
          thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=225&fit=crop',
          duration: '4 hours',
          level: 'Beginner',
          rating: 4.9,
          source: 'Programming with Mosh',
        },
        {
          externalId: 'yt-sql-course-mosh',
          title: 'SQL Tutorial for Beginners [Full Course]',
          description: 'Learn SQL relational database design, SELECT queries, INNER JOIN, LEFT JOIN, aggregate functions, and indexes.',
          url: 'https://www.youtube.com/watch?v=7S_tz1z_5bA',
          thumbnailUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&h=225&fit=crop',
          duration: '4.5 hours',
          level: 'Beginner',
          rating: 4.8,
          source: 'Programming with Mosh',
        },
        {
          externalId: 'yt-nodejs-traversy',
          title: 'Node.js Crash Course',
          description: 'Quickstart crash course covering Node core modules, HTTP server, File System, Path, and NPM packages.',
          url: 'https://www.youtube.com/watch?v=fBNz5xF-Kx4',
          thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=225&fit=crop',
          duration: '1.5 hours',
          level: 'Beginner',
          rating: 4.8,
          source: 'Traversy Media',
        },
        {
          externalId: 'yt-css-zero-to-hero',
          title: 'CSS Tutorial - Zero to Hero (Complete Course)',
          description: 'Master CSS selectors, Box Model, Flexbox, CSS Grid, media queries, and responsive web design.',
          url: 'https://www.youtube.com/watch?v=1Rs2ND1ryYc',
          thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&h=225&fit=crop',
          duration: '6 hours',
          level: 'All Levels',
          rating: 4.9,
          source: 'freeCodeCamp.org',
        },
        {
          externalId: 'yt-sql-full-database',
          title: 'SQL Tutorial - Full Database Course for Beginners',
          description: 'Comprehensive introduction to SQL schema design, foreign keys, table joins, nested queries, and triggers.',
          url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY',
          thumbnailUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&h=225&fit=crop',
          duration: '4 hours',
          level: 'Beginner',
          rating: 4.9,
          source: 'freeCodeCamp.org',
        },
        {
          externalId: 'yt-python-cs-dojo',
          title: 'Python Tutorial for Absolute Beginners #1',
          description: 'Intuitive step-by-step introduction to coding in Python for complete beginners with visual examples.',
          url: 'https://www.youtube.com/watch?v=Z1Yd7upQsXY',
          thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=225&fit=crop',
          duration: '1 hour',
          level: 'Beginner',
          rating: 4.8,
          source: 'CS Dojo',
        },
        {
          externalId: 'yt-frontend-roadmap',
          title: 'Front End Developer Roadmap – Skills and Tools',
          description: 'Career guide for frontend engineers covering HTML, CSS, JavaScript, React, build tools, and performance.',
          url: 'https://www.youtube.com/watch?v=9He4UBLyk8Y',
          thumbnailUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=225&fit=crop',
          duration: '2 hours',
          level: 'Beginner',
          rating: 4.9,
          source: 'freeCodeCamp.org',
        },
        {
          externalId: 'yt-fetch-api-async',
          title: 'Learn Fetch API In 6 Minutes (Async Web Requests)',
          description: 'Quick concise guide to making GET, POST, PUT, DELETE requests with JavaScript fetch and async/await.',
          url: 'https://www.youtube.com/watch?v=cuEtnrL9-H0',
          thumbnailUrl: 'https://images.unsplash.com/photo-1516116211227-bbc03a276e7b?w=400&h=225&fit=crop',
          duration: '30 mins',
          level: 'Intermediate',
          rating: 4.9,
          source: 'Web Dev Simplified',
        },
        {
          externalId: 'yt-html-full-tutorial',
          title: 'Learn HTML – Full Tutorial for Beginners',
          description: 'Master HTML5 semantic elements, forms, audio/video tags, accessibility, and modern SEO structures.',
          url: 'https://www.youtube.com/watch?v=kUMe1FH4CHE',
          thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&h=225&fit=crop',
          duration: '2 hours',
          level: 'Beginner',
          rating: 4.8,
          source: 'freeCodeCamp.org',
        },
        {
          externalId: 'yt-python-fireship',
          title: 'Python in 100 Seconds',
          description: 'Ultra-fast summary of the Python language, runtime, dynamic typing, syntax, and prominent use cases.',
          url: 'https://www.youtube.com/watch?v=x7X9w_GIm1s',
          thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=225&fit=crop',
          duration: '2 mins',
          level: 'Beginner',
          rating: 4.9,
          source: 'Fireship',
        },
        {
          externalId: 'yt-react-mosh',
          title: 'React Tutorial for Beginners [React 18 Crash Course]',
          description: 'Master React components, state, props, hooks, event handling, and form inputs with clean code.',
          url: 'https://www.youtube.com/watch?v=SqcY0GlETPk',
          thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=225&fit=crop',
          duration: '2.5 hours',
          level: 'Beginner',
          rating: 4.8,
          source: 'Programming with Mosh',
        },
        {
          externalId: 'yt-java-full-tutorial',
          title: 'Learn Java 8 - Full Tutorial for Beginners',
          description: 'Complete Java course: Object-Oriented Programming, classes, inheritance, polymorphism, and Java collections.',
          url: 'https://www.youtube.com/watch?v=grEKMHGYyns',
          thumbnailUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=225&fit=crop',
          duration: '9.5 hours',
          level: 'Beginner',
          rating: 4.8,
          source: 'freeCodeCamp.org',
        },
        {
          externalId: 'yt-js-crash-traversy',
          title: 'JavaScript Crash Course For Beginners',
          description: 'Modern JavaScript from scratch: data types, methods, DOM selectors, events, and single-page apps.',
          url: 'https://www.youtube.com/watch?v=hdI2bqOjy3c',
          thumbnailUrl: 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=400&h=225&fit=crop',
          duration: '1.5 hours',
          level: 'Beginner',
          rating: 4.9,
          source: 'Traversy Media',
        },
        {
          externalId: 'yt-python-crash-traversy',
          title: 'Python Crash Course For Beginners',
          description: 'Hands-on overview of Python syntax, dictionaries, tuples, functions, files, and JSON handling.',
          url: 'https://www.youtube.com/watch?v=JJmcL1N2KQs',
          thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=225&fit=crop',
          duration: '2 hours',
          level: 'Beginner',
          rating: 4.8,
          source: 'Traversy Media',
        },
        {
          externalId: 'yt-docker-mosh',
          title: 'Docker Tutorial for Beginners – Packaging and Containerization',
          description: 'Understand containerization vs virtual machines, Dockerfiles, images, ports, and Docker Compose.',
          url: 'https://www.youtube.com/watch?v=pTFZFxd4hOI',
          thumbnailUrl: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?w=400&h=225&fit=crop',
          duration: '1 hour',
          level: 'Beginner',
          rating: 4.9,
          source: 'Programming with Mosh',
        },
      ];
    }

    return [
      {
        externalId: 'udemy-react-complete-guide',
        title: 'React - The Complete Guide (incl. Next.js, Redux)',
        description: 'Dive in and learn React.js from scratch! Master React, Hooks, Redux, React Router, Next.js, and best practices.',
        url: 'https://www.udemy.com/course/react-the-complete-guide-incl-redux/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=225&fit=crop',
        duration: '50 hours',
        level: 'All Levels',
        rating: 4.8,
        source: 'Maximilian Schwarzmüller (Academind)',
      },
      {
        externalId: 'udemy-the-web-developer-bootcamp',
        title: 'The Web Developer Bootcamp 2026',
        description: 'The only course you need to learn web development: HTML, CSS, JavaScript, React, Node.js, MongoDB, and modern deployments.',
        url: 'https://www.udemy.com/course/the-web-developer-bootcamp/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=225&fit=crop',
        duration: '74 hours',
        level: 'Beginner to Professional',
        rating: 4.8,
        source: 'Colt Steele',
      },
      {
        externalId: 'udemy-complete-2026-web-development',
        title: 'The Complete Full-Stack Web Development Bootcamp',
        description: 'Learn modern full-stack development with hands-on projects, RESTful APIs, PostgreSQL, authentication, and cloud deployment.',
        url: 'https://www.udemy.com/course/the-complete-web-development-bootcamp/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=225&fit=crop',
        duration: '62 hours',
        level: 'Beginner to Advanced',
        rating: 4.9,
        source: 'Dr. Angela Yu (App Brewery)',
      },
      {
        externalId: 'udemy-aws-certified-developer',
        title: 'Ultimate AWS Certified Developer Associate 2026',
        description: 'Pass the AWS Certified Developer Associate DVA-C02 exam with full hands-on practice labs on Lambda, ECS, DynamoDB.',
        url: 'https://www.udemy.com/course/aws-certified-developer-associate-dva-c01/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=225&fit=crop',
        duration: '32 hours',
        level: 'Intermediate',
        rating: 4.9,
        source: 'Stephane Maarek',
      },
      {
        externalId: 'udemy-nestjs-zero-to-hero',
        title: 'NestJS: The Complete Developer Guide',
        description: 'Develop scalable backend microservices, dependency injection, TypeORM/Prisma integration, and production automated testing.',
        url: 'https://www.udemy.com/course/nestjs-the-complete-developers-guide/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=225&fit=crop',
        duration: '18 hours',
        level: 'Intermediate',
        rating: 4.8,
        source: 'Stephen Grider',
      },
      {
        externalId: 'udemy-complete-javascript-course',
        title: 'The Complete JavaScript Course 2026: From Zero to Expert!',
        description: 'Master modern JavaScript (ES6+, OOP, Async/Await, Webpack, Babel) by building real-world projects and learning core theory.',
        url: 'https://www.udemy.com/course/the-complete-javascript-course/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=400&h=225&fit=crop',
        duration: '68 hours',
        level: 'All Levels',
        rating: 4.8,
        source: 'Jonas Schmedtmann',
      },
      {
        externalId: 'udemy-complete-node-developer',
        title: 'Complete NodeJS Developer: Zero to Mastery (GraphQL, REST, Deno)',
        description: 'Master Node.js, Express, MongoDB, REST APIs, GraphQL, sockets, authentication, CI/CD, and microservices.',
        url: 'https://www.udemy.com/course/complete-nodejs-developer-zero-to-mastery/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=225&fit=crop',
        duration: '46 hours',
        level: 'Intermediate',
        rating: 4.8,
        source: 'Andrei Neagoie & Adam Odziemkowski',
      },
      {
        externalId: 'udemy-docker-kubernetes-practical',
        title: 'Docker & Kubernetes: The Practical Guide',
        description: 'Learn Docker, Docker Compose, Multi-Container Apps, Kubernetes, EKS deployment, and configuration management from scratch.',
        url: 'https://www.udemy.com/course/docker-kubernetes-the-practical-guide/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?w=400&h=225&fit=crop',
        duration: '23 hours',
        level: 'All Levels',
        rating: 4.9,
        source: 'Maximilian Schwarzmüller',
      },
      {
        externalId: 'udemy-python-mega-course',
        title: '100 Days of Code: The Complete Python Pro Bootcamp',
        description: 'Master Python by building 100 projects in 100 days. Learn Data Science, Automation, Web Development with Flask, APIs and GUI.',
        url: 'https://www.udemy.com/course/100-days-of-code/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=225&fit=crop',
        duration: '56 hours',
        level: 'Beginner to Advanced',
        rating: 4.9,
        source: 'Dr. Angela Yu',
      },
      {
        externalId: 'udemy-sql-and-postgresql',
        title: 'SQL and PostgreSQL: The Complete Developer Guide',
        description: 'Become an expert with SQL and PostgreSQL. Master database design, complex joins, views, indexing, and query optimization.',
        url: 'https://www.udemy.com/course/sql-and-postgresql/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&h=225&fit=crop',
        duration: '22 hours',
        level: 'All Levels',
        rating: 4.8,
        source: 'Stephen Grider',
      },
      {
        externalId: 'udemy-advanced-css-sass',
        title: 'Advanced CSS and Sass: Flexbox, Grid, Animations and More!',
        description: 'The most advanced and modern CSS course on the web: master Flexbox, CSS Grid, responsive design, and CSS architecture.',
        url: 'https://www.udemy.com/course/advanced-css-and-sass/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&h=225&fit=crop',
        duration: '28 hours',
        level: 'Intermediate to Advanced',
        rating: 4.8,
        source: 'Jonas Schmedtmann',
      },
      {
        externalId: 'udemy-git-github-bootcamp',
        title: 'The Git & GitHub Bootcamp',
        description: 'Master Git, GitHub, branching, rebasing, stash, cherry-picking, interactive rebase, and open-source contributions.',
        url: 'https://www.udemy.com/course/git-and-github-bootcamp/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=400&h=225&fit=crop',
        duration: '17 hours',
        level: 'Beginner to Advanced',
        rating: 4.8,
        source: 'Colt Steele',
      },
      {
        externalId: 'udemy-go-complete-developer',
        title: 'Go: The Complete Developer Guide (Golang)',
        description: 'Master concurrency with goroutines and channels, type interfaces, testing, and building web servers with Go.',
        url: 'https://www.udemy.com/course/go-the-complete-developers-guide/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=225&fit=crop',
        duration: '10 hours',
        level: 'Intermediate',
        rating: 4.8,
        source: 'Stephen Grider',
      },
      {
        externalId: 'udemy-microservices-node-react',
        title: 'Microservices with Node JS and React',
        description: 'Build, deploy, and scale an E-Commerce microservices app with Docker, Kubernetes, NATS Streaming, and Next.js.',
        url: 'https://www.udemy.com/course/microservices-with-node-js-and-react/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=225&fit=crop',
        duration: '54 hours',
        level: 'Advanced',
        rating: 4.9,
        source: 'Stephen Grider',
      },
      {
        externalId: 'udemy-typescript-developer-guide',
        title: 'Typescript: The Complete Developer Guide',
        description: 'Master TypeScript design patterns, generic classes, decorators, and integration with React and Redux.',
        url: 'https://www.udemy.com/course/typescript-the-complete-developers-guide/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1516116211227-bbc03a276e7b?w=400&h=225&fit=crop',
        duration: '24 hours',
        level: 'All Levels',
        rating: 4.8,
        source: 'Stephen Grider',
      },
      {
        externalId: 'udemy-spring-boot-hibernate',
        title: 'Spring Boot 3, Spring 6 & Hibernate for Beginners',
        description: 'Learn Spring Boot, REST APIs, Spring Security, JPA/Hibernate, Maven, and full-stack microservices architecture.',
        url: 'https://www.udemy.com/course/spring-hibernate-tutorial/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=225&fit=crop',
        duration: '40 hours',
        level: 'Beginner to Intermediate',
        rating: 4.9,
        source: 'Chad Darby',
      },
      {
        externalId: 'udemy-vue-complete-guide',
        title: 'Vue - The Complete Guide (incl. Router & Composition API)',
        description: 'Vue.js from scratch! Master Vue 3, Composition API, Options API, Vue Router, Vuex, Pinia, and animated transitions.',
        url: 'https://www.udemy.com/course/vuejs-2-the-complete-guide/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=225&fit=crop',
        duration: '32 hours',
        level: 'All Levels',
        rating: 4.8,
        source: 'Maximilian Schwarzmüller',
      },
      {
        externalId: 'udemy-angular-complete-guide',
        title: 'Angular - The Complete Guide (2026 Edition)',
        description: 'Master Angular 18+, Signals, Standalone Components, RxJS, TypeScript, Observables, and enterprise state management.',
        url: 'https://www.udemy.com/course/the-complete-guide-to-angular-2/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&h=225&fit=crop',
        duration: '36 hours',
        level: 'All Levels',
        rating: 4.8,
        source: 'Maximilian Schwarzmüller',
      },
      {
        externalId: 'udemy-kubernetes-beginners',
        title: 'Kubernetes for the Absolute Beginners - Hands-on',
        description: 'Learn Kubernetes step-by-step with practical hands-on labs in browser. Pods, ReplicaSets, Deployments, and Services.',
        url: 'https://www.udemy.com/course/learn-devops-kubernetes-deploying-microservices/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?w=400&h=225&fit=crop',
        duration: '6 hours',
        level: 'Beginner',
        rating: 4.9,
        source: 'Mumshad Mannambeth',
      },
      {
        externalId: 'udemy-aws-solutions-architect',
        title: 'Ultimate AWS Certified Solutions Architect Associate 2026',
        description: 'Full preparation for the SAA-C03 exam: VPC, IAM, EC2, S3, RDS, CloudFront, Route53, and high availability design.',
        url: 'https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=225&fit=crop',
        duration: '27 hours',
        level: 'Intermediate',
        rating: 4.9,
        source: 'Stephane Maarek',
      },
      {
        externalId: 'udemy-flutter-dart-guide',
        title: 'Flutter & Dart - The Complete Guide [2026 Edition]',
        description: 'A complete guide to the Flutter SDK & Dart framework for building native iOS and Android mobile apps.',
        url: 'https://www.udemy.com/course/learn-flutter-dart-to-build-ios-android-apps/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=225&fit=crop',
        duration: '30 hours',
        level: 'All Levels',
        rating: 4.8,
        source: 'Maximilian Schwarzmüller',
      },
      {
        externalId: 'udemy-machine-learning-az',
        title: 'Machine Learning A-Z: AI, Python & R + ChatGPT Prize',
        description: 'Learn to create Machine Learning Algorithms in Python and R from two Data Science experts. Includes code templates.',
        url: 'https://www.udemy.com/course/machinelearning/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=225&fit=crop',
        duration: '42 hours',
        level: 'All Levels',
        rating: 4.8,
        source: 'Kirill Eremenko & Hadelin de Ponteves',
      },
      {
        externalId: 'udemy-deep-learning-az',
        title: 'Deep Learning A-Z: Hands-On Artificial Neural Networks',
        description: 'Learn and build Deep Learning Models in Python using TensorFlow, PyTorch, CNNs, RNNs, and Self Organizing Maps.',
        url: 'https://www.udemy.com/course/deeplearning/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=225&fit=crop',
        duration: '23 hours',
        level: 'Intermediate',
        rating: 4.7,
        source: 'Kirill Eremenko & Hadelin de Ponteves',
      },
      {
        externalId: 'udemy-ethical-hacking-network',
        title: 'The Complete Ethical Hacking Course: Beginner to Advanced',
        description: 'Learn ethical hacking, penetration testing, Wi-Fi security, Kali Linux, Metasploit, and vulnerability scanners.',
        url: 'https://www.udemy.com/course/the-complete-internet-security-privacy-course-volume-1/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=225&fit=crop',
        duration: '25 hours',
        level: 'All Levels',
        rating: 4.7,
        source: 'Nathan House',
      },
      {
        externalId: 'udemy-linux-administration',
        title: 'Complete Linux Training Course to Get your Dream IT Job',
        description: 'The complete course for RedHat Linux, CentOS, Ubuntu, Bash scripting, system troubleshooting, and administration.',
        url: 'https://www.udemy.com/course/linux-mastery/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=400&h=225&fit=crop',
        duration: '28 hours',
        level: 'Beginner to Advanced',
        rating: 4.8,
        source: 'Imran Afzal',
      },
      {
        externalId: 'udemy-apache-kafka-beginners',
        title: 'Apache Kafka Series - Learn Apache Kafka for Beginners',
        description: 'Master Apache Kafka core concepts, producers, consumers, consumer groups, brokers, topics, and real-time streaming.',
        url: 'https://www.udemy.com/course/apache-kafka/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&h=225&fit=crop',
        duration: '9 hours',
        level: 'Intermediate',
        rating: 4.8,
        source: 'Stephane Maarek',
      },
      {
        externalId: 'udemy-graphql-with-react',
        title: 'GraphQL with React: The Complete Developers Guide',
        description: 'Learn and master GraphQL by building real web apps with React and Node. Schema design, Apollo Client, and mutations.',
        url: 'https://www.udemy.com/course/graphql-with-react-course/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=225&fit=crop',
        duration: '13 hours',
        level: 'Intermediate',
        rating: 4.8,
        source: 'Stephen Grider',
      },
      {
        externalId: 'udemy-dsa-python',
        title: 'Data Structures & Algorithms in Python: Deep Dive',
        description: 'Master big O notation, linked lists, stacks, queues, binary search trees, hash tables, and graph algorithms in Python.',
        url: 'https://www.udemy.com/course/python-data-structures-algorithms/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1516116211227-bbc03a276e7b?w=400&h=225&fit=crop',
        duration: '11 hours',
        level: 'All Levels',
        rating: 4.9,
        source: 'Scott Barrett',
      },
      {
        externalId: 'udemy-nextjs-complete-guide',
        title: 'Next.js 15 & React - The Complete Guide',
        description: 'Build fullstack React applications with Next.js 15, App Router, Server Actions, Authentication, and Vercel Deployment.',
        url: 'https://www.udemy.com/course/nextjs-react-the-complete-guide/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=225&fit=crop',
        duration: '31 hours',
        level: 'All Levels',
        rating: 4.9,
        source: 'Maximilian Schwarzmüller',
      },
      {
        externalId: 'udemy-clean-code',
        title: 'Clean Code: Writing Code for Humans',
        description: 'Learn how to write clean, maintainable, readable, and testable code. Avoid code smells, refactor with confidence.',
        url: 'https://www.udemy.com/course/clean-code/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=225&fit=crop',
        duration: '7 hours',
        level: 'All Levels',
        rating: 4.8,
        source: 'Maximilian Schwarzmüller',
      },
    ];
  }

  // =========================================================================
  // 8. GEMINI 1.5 FLASH AI SKILL EXTRACTION & DEEP ENRICHMENT ENGINE
  // =========================================================================
  async assignSkillsToJob(
    jobId: string,
    title: string,
    description?: string,
    requirements?: string,
  ) {
    try {
      // 1. Extract skills using Gemini 1.5 Flash (or Smart Rule-Based Engine if API key is not present)
      const extractedSkills = await this.geminiExtractor.extractSkills(
        title,
        description || '',
        requirements,
      );

      if (!extractedSkills || extractedSkills.length === 0) return;

      for (const item of extractedSkills) {
        // Find existing skill by name (case-insensitive) or create new skill
        let skill = await this.prisma.skill.findFirst({
          where: { name: { equals: item.name, mode: 'insensitive' } },
        });

        if (!skill) {
          const slug = `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
          skill = await this.prisma.skill.create({
            data: {
              name: item.name,
              slug,
              category: item.category,
              description: `Proficiency with ${item.name} for modern engineering architectures.`,
            },
          });
        }

        // Link skill to job
        await this.prisma.jobSkill.upsert({
          where: { jobId_skillId: { jobId, skillId: skill.id } },
          create: {
            jobId,
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
    } catch (err: any) {
      this.logger.warn(`Failed to auto-assign skills to job ${jobId}: ${err.message}`);
    }
  }

  /**
   * Enriches jobs with deep scraped details (description + qualifications)
   * and extracts skills using Gemini 1.5 Flash.
   */
  async enrichJobsWithAi(limit = 20) {
    this.logger.log(`[AI Enriched Ingestion] Fetching up to ${limit} jobs to enrich with deep details & Gemini skills...`);
    const jobs = await this.prisma.job.findMany({
      where: {
        sourceUrl: { not: null },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    let enrichedCount = 0;
    for (const job of jobs) {
      try {
        if (!job.sourceUrl) continue;
        // 1. Fetch deep details from platform (e.g. JobThai schema.org or Blognone full article)
        const deepDetails = await this.geminiExtractor.fetchDeepJobDetails(job.source, job.sourceUrl, {
          description: job.description,
          requirements: job.requirements || undefined,
          company: job.companyName,
          logoUrl: job.companyLogoUrl || undefined,
          benefits: job.benefits || undefined,
        });

        // 2. Update job record with real company and details
        const updated = await this.prisma.job.update({
          where: { id: job.id },
          data: {
            description: deepDetails.description || job.description,
            requirements: deepDetails.requirements || job.requirements,
            companyName: deepDetails.company || job.companyName,
            companyLogoUrl: deepDetails.logoUrl || job.companyLogoUrl,
            benefits: deepDetails.benefits || job.benefits,
          },
        });

        // 3. Extract skills using Gemini 1.5 Flash
        await this.assignSkillsToJob(
          updated.id,
          updated.title,
          updated.description,
          updated.requirements || undefined,
        );

        enrichedCount++;
      } catch (err: any) {
        this.logger.warn(`Failed to enrich job ${job.id}: ${err.message}`);
      }
    }

    this.logger.log(`[AI Enriched Ingestion] Finished enriching ${enrichedCount} jobs with deep details & Gemini skills!`);
    return { success: true, enrichedJobs: enrichedCount };
  }

  /**
   * Backfill skills for all existing jobs that currently have 0 required skills
   */
  async backfillAllJobSkills() {
    this.logger.log('[Tech Stack Engine] Backfilling skills for all active jobs without skills...');
    const jobs = await this.prisma.job.findMany({
      where: { skills: { none: {} } },
      select: { id: true, title: true, description: true, requirements: true },
    });

    let count = 0;
    for (const job of jobs) {
      await this.assignSkillsToJob(job.id, job.title, job.description, job.requirements || undefined);
      count++;
    }

    this.logger.log(`[Tech Stack Engine] Successfully backfilled tech stack skills for ${count} jobs!`);
    return { success: true, backfilledJobs: count };
  }
}
