import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { IngestionStatus, JobSource } from '@smartcareer/shared';

export interface ScreeningResultItem {
  id: string;
  title: string;
  companyName: string;
  source: any;
  sourceUrl?: string | null;
  reason: string;
  reasonCode: 'EXPIRED_DATE' | 'MANUAL_INACTIVE' | 'DEAD_LINK_HTTP' | 'CLOSED_CONTENT';
  actionTaken?: 'DELETED' | 'DEACTIVATED' | 'PREVIEW_ONLY';
}

export interface ScreeningSummary {
  scannedCount: number;
  uncheckedCount: number;
  uncheckedItems: { id: string; title: string; reason: string }[];
  closedCount: number;
  deletedCount: number;
  deactivatedCount: number;
  reasons: {
    expiredDate: number;
    manualInactive: number;
    deadLinkHttp: number;
    closedContent: number;
  };
  items: ScreeningResultItem[];
}

@Injectable()
export class JobScreeningService {
  private readonly logger = new Logger(JobScreeningService.name);

  // Indicators that an external job post is closed or expired
  private readonly CLOSED_KEYWORDS_TH = [
    'ปิดรับสมัครแล้ว',
    'ตำแหน่งงานนี้ปิดรับสมัครแล้ว',
    'ปิดรับสมัคร',
    'ไม่พบตำแหน่งงาน',
    'ไม่มีตำแหน่งงานนี้',
    'หมดอายุแล้ว',
    'สิ้นสุดการรับสมัคร',
    'การรับสมัครสิ้นสุดลงแล้ว',
  ];

  private readonly CLOSED_KEYWORDS_EN = [
    'this job has expired',
    'no longer accepting applications',
    'this job is closed',
    'job is closed',
    'position is closed',
    'this role is closed',
    'no longer available',
    'job expired',
    'this job offer is closed',
    'page not found',
    'job not found',
  ];

  constructor(private prisma: PrismaService) {}

  private async checkExternalUrl(url: string): Promise<{ isClosed: boolean; reason?: string; reasonCode?: any; unchecked?: boolean }> {
    const unknown = (reason: string) => ({ isClosed: false, unchecked: true, reason });
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'SmartCareer/1.0', Accept: 'text/html' },
        timeout: 6000, validateStatus: () => true, maxRedirects: 4,
      });
      if (response.status === 404 || response.status === 410) {
        return { isClosed: true, reason: 'ลิงก์ต้นทางไม่พบประกาศ (HTTP ' + response.status + ')', reasonCode: 'DEAD_LINK_HTTP' };
      }
      if (response.status !== 200) return unknown('ต้นทางตอบ HTTP ' + response.status + ' — ยังสรุปว่างานปิดไม่ได้');
      if (typeof response.data !== 'string') return unknown('ต้นทางไม่ได้ส่งหน้าเนื้อหาประกาศ');
      const $ = cheerio.load(response.data);
      if ($('title').text().match(/just a moment|access denied|captcha/i) || $('[class*="captcha"], #challenge-form').length) {
        return unknown('ต้นทางต้องยืนยันการเข้าถึง');
      }
      $('script, style, template, noscript, nav, footer, aside, [hidden], [aria-hidden="true"]').remove();
      $('[style]').each((_i, element) => {
        if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test($(element).attr('style') || '')) $(element).remove();
      });
      // Restrict evidence to short status messages in the main content, not scripts or related-job panels.
      const main = $('main').length ? $('main') : $('body');
      const statusTexts = main.find('h1, h2, h3, p, [role="alert"], div, span').add(main).toArray()
        .filter(el => $(el).children().length === 0)
        .map(el => $(el).text().replace(/\s+/g, ' ').trim().toLowerCase())
        .filter(text => text.length > 0 && text.length <= 240);
      const keywords = [...this.CLOSED_KEYWORDS_TH, ...this.CLOSED_KEYWORDS_EN]
        .filter(word => !['no longer available', 'page not found', 'ปิดรับสมัคร'].includes(word));
      const closed = statusTexts.find(text => keywords.some(word => text.includes(word)));
      if (closed) return { isClosed: true, reason: 'พบข้อความสถานะปิดรับสมัครในเนื้อหาประกาศ', reasonCode: 'CLOSED_CONTENT' };
      const apply = main.find('a[href], button:not([disabled])').toArray().some(el =>
        /^(apply now|apply for this job|สมัครงาน|สมัครงานนี้)$/i.test($(el).text().trim()));
      if (apply) return { isClosed: false };
      return unknown('ไม่พบหลักฐานสถานะประกาศที่ยืนยันได้ — เก็บงานไว้');
    } catch {
      return unknown('ติดต่อเว็บไซต์ต้นทางไม่ได้หรือหมดเวลา — เก็บงานไว้');
    }
  }

  /**
   * Evaluates if a given job record should be considered closed
   */
  async evaluateJob(job: any): Promise<{ isClosed: boolean; reason?: string; reasonCode?: any; unchecked?: boolean }> {
    const now = new Date();

    // 1. Date Expiration Check
    if (job.expiresAt && new Date(job.expiresAt) <= now) {
      return {
        isClosed: true,
        reason: `ประกาศหมดอายุตามวันที่กำหนด (${new Date(job.expiresAt).toLocaleDateString('th-TH')})`,
        reasonCode: 'EXPIRED_DATE',
      };
    }

    // 2. Manual Inactive Check
    if (job.isActive === false) {
      return {
        isClosed: true,
        reason: 'สถานะประกาศถูกปิดการรับสมัคร (isActive = false)',
        reasonCode: 'MANUAL_INACTIVE',
      };
    }

    // 3. For External Jobs, verify Source URL health
    if (job.source !== JobSource.INTERNAL && job.sourceUrl) {
      const urlCheck = await this.checkExternalUrl(job.sourceUrl);
      if (urlCheck.isClosed || urlCheck.unchecked) {
        return urlCheck;
      }
    }
    if (job.source !== JobSource.INTERNAL && !job.sourceUrl) {
      return { isClosed: false, unchecked: true, reason: 'ไม่มีลิงก์ต้นทางให้ตรวจสอบ' };
    }

    return { isClosed: false };
  }

  /**
   * Preview screening without making any database deletions (Dry-Run mode)
   */
  async previewClosedJobs(source?: JobSource | 'ALL', limit = 100): Promise<ScreeningSummary> {
    this.logger.log(`[Job Screening Preview] Starting dry-run scan (Source: ${source || 'ALL'}, Limit: ${limit})...`);
    return this.runScreeningPipeline({ source, limit, dryRun: true, deleteMode: 'DELETE' });
  }

  /**
   * Close unavailable jobs without deleting their applications, favorites or history.
   * Legacy DELETE requests are deliberately treated as DEACTIVATE as well.
   */
  async scanAndCleanJobs(options: {
    source?: JobSource | 'ALL';
    limit?: number;
    deleteMode?: 'DELETE' | 'DEACTIVATE';
  }): Promise<ScreeningSummary> {
    const mode = 'DEACTIVATE';
    this.logger.log(`[Job Screening Engine] Running scan & cleanup (Source: ${options.source || 'ALL'}, Mode: ${mode})...`);
    return this.runScreeningPipeline({
      source: options.source,
      limit: options.limit || 200,
      dryRun: false,
      deleteMode: mode,
    });
  }

  /**
   * Shared screening pipeline
   */
  private async runScreeningPipeline(params: {
    source?: JobSource | 'ALL';
    limit?: number;
    dryRun: boolean;
    deleteMode: 'DELETE' | 'DEACTIVATE';
  }): Promise<ScreeningSummary> {
    const startedAt = new Date();
    const where: any = { isActive: true };

    if (params.source && params.source !== 'ALL') {
      where.source = params.source;
    }

    const scope = params.source || 'ALL';
    const previous = await this.prisma.ingestionLog.findFirst({
      where: { source: 'JOB_CLEANUP', metadata: { path: ['screeningScope'], equals: scope } },
      orderBy: { finishedAt: 'desc' }, select: { metadata: true },
    });
    const cursor = (previous?.metadata as any)?.lastScannedId;
    const limit = Math.max(1, Math.min(params.limit || 200, 1000));
    const query = {
      where,
      orderBy: { id: 'asc' as const },
      take: limit,
      select: {
        id: true,
        title: true,
        companyName: true,
        source: true,
        sourceUrl: true,
        expiresAt: true,
        isActive: true,
      },
    };
    const jobs = await this.prisma.job.findMany({ ...query, where: { ...where, ...(cursor ? { id: { gt: cursor } } : {}) } });
    if (cursor && jobs.length < limit) {
      jobs.push(...await this.prisma.job.findMany({ ...query, where: { ...where, id: { lte: cursor } }, take: limit - jobs.length }));
    }


    const summary: ScreeningSummary = {
      uncheckedCount: 0, uncheckedItems: [],
      scannedCount: jobs.length,
      closedCount: 0,
      deletedCount: 0,
      deactivatedCount: 0,
      reasons: {
        expiredDate: 0,
        manualInactive: 0,
        deadLinkHttp: 0,
        closedContent: 0,
      },
      items: [],
    };

    const closedJobsToDeactivate: string[] = [];

    // Process in batches of 5 to avoid overwhelming network/sites
    const batchSize = 5;
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (job) => {
          const evalResult = await this.evaluateJob(job);
          if (evalResult.unchecked) {
            summary.uncheckedCount++;
            summary.uncheckedItems.push({ id: job.id, title: job.title, reason: evalResult.reason || 'ตรวจไม่ได้' });
          }
          if (evalResult.isClosed) {
            summary.closedCount++;

            if (evalResult.reasonCode === 'EXPIRED_DATE') summary.reasons.expiredDate++;
            else if (evalResult.reasonCode === 'MANUAL_INACTIVE') summary.reasons.manualInactive++;
            else if (evalResult.reasonCode === 'DEAD_LINK_HTTP') summary.reasons.deadLinkHttp++;
            else if (evalResult.reasonCode === 'CLOSED_CONTENT') summary.reasons.closedContent++;

            const item: ScreeningResultItem = {
              id: job.id,
              title: job.title,
              companyName: job.companyName,
              source: job.source,
              sourceUrl: job.sourceUrl,
              reason: evalResult.reason || 'งานปิดรับสมัครแล้ว',
              reasonCode: evalResult.reasonCode || 'EXPIRED_DATE',
              actionTaken: params.dryRun
                ? 'PREVIEW_ONLY'
                : 'DEACTIVATED',
            };
            summary.items.push(item);

            if (!params.dryRun) {
              closedJobsToDeactivate.push(job.id);
            }
          }
        }),
      );
    }

    // Execute database changes
    if (!params.dryRun) {
      if (closedJobsToDeactivate.length > 0) {
        const updateResult = await this.prisma.job.updateMany({
          where: { id: { in: closedJobsToDeactivate }, isActive: true },
          data: { isActive: false },
        });
        summary.deactivatedCount = updateResult.count;
      }

      // Record Execution Audit Log
      const finishedAt = new Date();
      await this.prisma.ingestionLog.create({
        data: {
          source: 'JOB_CLEANUP' as any,
          status: summary.uncheckedCount ? (summary.uncheckedCount === summary.scannedCount ? IngestionStatus.FAILED : IngestionStatus.PARTIAL_SUCCESS) : IngestionStatus.SUCCESS,
          startedAt,
          finishedAt,
          createdCount: 0,
          updatedCount: summary.deactivatedCount,
          duplicateCount: summary.deletedCount, // Using duplicateCount column to track deleted
          errorCount: summary.uncheckedCount,
          errorMessage: summary.uncheckedCount ? 'บางประกาศยังตรวจสถานะไม่ได้ และไม่ได้ปิดประกาศเหล่านั้น' : null,
          metadata: {
            screeningScope: scope,
            lastScannedId: jobs.length ? jobs[jobs.length - 1].id : cursor || null,
            uncheckedCount: summary.uncheckedCount,
            scannedCount: summary.scannedCount,
            closedFound: summary.closedCount,
            deletedCount: summary.deletedCount,
            deactivatedCount: summary.deactivatedCount,
            reasons: summary.reasons,
          },
        },
      });

      this.logger.log(
        `[Job Screening Engine] Complete: Scanned ${summary.scannedCount}, Found Closed ${summary.closedCount}, Deactivated ${summary.deactivatedCount} jobs; history preserved.`,
      );
    } else {
      this.logger.log(
        `[Job Screening Preview] Complete: Scanned ${summary.scannedCount}, Found Closed ${summary.closedCount} jobs (No database changes).`,
      );
    }

    return summary;
  }
}
