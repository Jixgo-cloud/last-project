import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { execFileSync } from 'child_process';
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

  /**
   * Helper to perform native HTTP check with curl fallback to bypass bot filters
   */
  private async checkExternalUrl(url: string): Promise<{ isClosed: boolean; reason?: string; reasonCode?: any }> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        timeout: 6000,
        validateStatus: () => true, // capture all status codes
        maxRedirects: 4,
      });

      if (response.status === 404 || response.status === 410) {
        return {
          isClosed: true,
          reason: `ลิงก์ต้นทางถูกลบหรือหมดอายุ (HTTP ${response.status} Not Found)`,
          reasonCode: 'DEAD_LINK_HTTP',
        };
      }

      const bodyText = typeof response.data === 'string' ? response.data.toLowerCase() : '';

      // Check Thai indicators
      for (const kw of this.CLOSED_KEYWORDS_TH) {
        if (bodyText.includes(kw)) {
          return {
            isClosed: true,
            reason: `ตรวจพบข้อความระบุว่าปิดรับสมัคร: "${kw}"`,
            reasonCode: 'CLOSED_CONTENT',
          };
        }
      }

      // Check English indicators
      for (const kw of this.CLOSED_KEYWORDS_EN) {
        if (bodyText.includes(kw)) {
          return {
            isClosed: true,
            reason: `ตรวจพบข้อความสถานะปิดรับสมัคร: "${kw}"`,
            reasonCode: 'CLOSED_CONTENT',
          };
        }
      }

      return { isClosed: false };
    } catch (err: any) {
      // If axios fails due to network/DNS/timeout, attempt fast curl native check
      try {
        const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
        const stdout = execFileSync(
          curlBin,
          [
            '-s',
            '-L',
            '--max-time', '6',
            '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            '-I', // Header only check
            url,
          ],
          { maxBuffer: 1024 * 1024, encoding: 'utf-8' },
        );

        if (stdout.includes('404 Not Found') || stdout.includes('410 Gone')) {
          return {
            isClosed: true,
            reason: 'ตรวจพบ HTTP 404 Not Found จากการตรวจสอบ Header',
            reasonCode: 'DEAD_LINK_HTTP',
          };
        }
      } catch {
        // Ignored, fallback to keeping job if site temporarily throttles
      }

      return { isClosed: false };
    }
  }

  /**
   * Evaluates if a given job record should be considered closed
   */
  async evaluateJob(job: any): Promise<{ isClosed: boolean; reason?: string; reasonCode?: any }> {
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
      if (urlCheck.isClosed) {
        return urlCheck;
      }
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
    const where: any = {};

    if (params.source && params.source !== 'ALL') {
      where.source = params.source;
    }

    const jobs = await this.prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 200,
      select: {
        id: true,
        title: true,
        companyName: true,
        source: true,
        sourceUrl: true,
        expiresAt: true,
        isActive: true,
      },
    });

    const summary: ScreeningSummary = {
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
          status: IngestionStatus.SUCCESS,
          startedAt,
          finishedAt,
          createdCount: 0,
          updatedCount: summary.deactivatedCount,
          duplicateCount: summary.deletedCount, // Using duplicateCount column to track deleted
          errorCount: 0,
          errorMessage: null,
          metadata: JSON.stringify({
            scannedCount: summary.scannedCount,
            closedFound: summary.closedCount,
            deletedCount: summary.deletedCount,
            deactivatedCount: summary.deactivatedCount,
            reasons: summary.reasons,
          }),
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
