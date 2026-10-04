import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { IngestionStatus, CourseSource } from '@smartcareer/shared';

export interface CourseScreeningResultItem {
  id: string;
  title: string;
  provider: any;
  url: string;
  thumbnailUrl?: string | null;
  reason: string;
  reasonCode: 'OEMBED_404_DELETED' | 'OEMBED_401_PRIVATE' | 'OEMBED_400_INVALID' | 'HTTP_404_NOT_FOUND' | 'CONTENT_RETIRED';
  actionTaken?: 'DELETED' | 'PREVIEW_ONLY';
}

export interface CourseScreeningSummary {
  scannedCount: number;
  closedCount: number;
  deletedCount: number;
  reasons: {
    oembedDeleted: number;
    oembedPrivate: number;
    oembedInvalid: number;
    httpNotFound: number;
    contentRetired: number;
  };
  items: CourseScreeningResultItem[];
}

@Injectable()
export class CourseScreeningService {
  private readonly logger = new Logger(CourseScreeningService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Check YouTube course health via official oEmbed API
   */
  private async checkYouTubeCourse(url: string): Promise<{ isClosed: boolean; reason?: string; reasonCode?: any }> {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await axios.get(oembedUrl, {
        timeout: 6000,
        validateStatus: () => true, // capture status codes
      });

      if (response.status === 404) {
        return {
          isClosed: true,
          reason: 'วิดีโอนี้ถูกลบออกจาก YouTube แล้ว (oEmbed 404 Not Found)',
          reasonCode: 'OEMBED_404_DELETED',
        };
      }

      if (response.status === 401) {
        return {
          isClosed: true,
          reason: 'วิดีโอนี้ถูกตั้งค่าเป็นส่วนตัวหรือไม่สามารถเข้าถึงได้ (oEmbed 401 Private Video)',
          reasonCode: 'OEMBED_401_PRIVATE',
        };
      }

      if (response.status === 400) {
        return {
          isClosed: true,
          reason: 'รหัสวิดีโอ YouTube ไม่ถูกต้องหรือไม่พบสื่อนี้ (oEmbed 400 Bad Request)',
          reasonCode: 'OEMBED_400_INVALID',
        };
      }

      return { isClosed: false };
    } catch (err: any) {
      this.logger.warn(`[YouTube Health Check] Network error for ${url}: ${err.message}`);
      return { isClosed: false }; // Keep course on transient network glitch
    }
  }

  /**
   * Check Udemy or generic course health
   */
  private async checkUdemyOrGenericCourse(url: string): Promise<{ isClosed: boolean; reason?: string; reasonCode?: any }> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 6000,
        validateStatus: () => true,
        maxRedirects: 4,
      });

      if (response.status === 404 || response.status === 410) {
        return {
          isClosed: true,
          reason: `หน้าคอร์สเรียนไม่พบในระบบ (HTTP ${response.status} Not Found)`,
          reasonCode: 'HTTP_404_NOT_FOUND',
        };
      }

      // If Cloudflare blocks automated request with 403, safely keep course
      if (response.status === 403) {
        return { isClosed: false };
      }

      const bodyText = typeof response.data === 'string' ? response.data.toLowerCase() : '';
      if (
        bodyText.includes('this course is no longer available') ||
        bodyText.includes('course not found') ||
        bodyText.includes('course retired')
      ) {
        return {
          isClosed: true,
          reason: 'คอร์สเรียนนี้ยุติการสอนหรือปิดตัวแล้ว (Course Retired / Not Available)',
          reasonCode: 'CONTENT_RETIRED',
        };
      }

      return { isClosed: false };
    } catch {
      return { isClosed: false };
    }
  }

  /**
   * Evaluates if a given course record should be considered unavailable or deleted
   */
  async evaluateCourse(course: any): Promise<{ isClosed: boolean; reason?: string; reasonCode?: any }> {
    if (!course.url) {
      return {
        isClosed: true,
        reason: 'ไม่มีลิงก์ URL สำหรับเข้าเรียน',
        reasonCode: 'HTTP_404_NOT_FOUND',
      };
    }

    const isYouTube =
      course.provider === CourseSource.YOUTUBE ||
      course.url.includes('youtube.com') ||
      course.url.includes('youtu.be');

    if (isYouTube) {
      return this.checkYouTubeCourse(course.url);
    } else {
      return this.checkUdemyOrGenericCourse(course.url);
    }
  }

  /**
   * Preview course screening without making database changes (Dry-Run mode)
   */
  async previewClosedCourses(provider?: CourseSource | 'ALL', limit = 100): Promise<CourseScreeningSummary> {
    this.logger.log(`[Course Screening Preview] Starting dry-run scan (Provider: ${provider || 'ALL'}, Limit: ${limit})...`);
    return this.runCourseScreeningPipeline({ provider, limit, dryRun: true });
  }

  /**
   * Run course screening and permanently delete unavailable courses
   */
  async scanAndCleanCourses(options: {
    provider?: CourseSource | 'ALL';
    limit?: number;
    deleteMode?: 'DELETE';
  }): Promise<CourseScreeningSummary> {
    this.logger.log(`[Course Screening Engine] Running scan & cleanup (Provider: ${options.provider || 'ALL'})...`);
    return this.runCourseScreeningPipeline({
      provider: options.provider,
      limit: options.limit || 200,
      dryRun: false,
    });
  }

  /**
   * Shared course screening pipeline
   */
  private async runCourseScreeningPipeline(params: {
    provider?: CourseSource | 'ALL';
    limit?: number;
    dryRun: boolean;
  }): Promise<CourseScreeningSummary> {
    const startedAt = new Date();
    const where: any = {};

    if (params.provider && params.provider !== 'ALL') {
      where.provider = params.provider;
    }

    const courses = await this.prisma.course.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 200,
      select: {
        id: true,
        title: true,
        provider: true,
        url: true,
        thumbnailUrl: true,
      },
    });

    const summary: CourseScreeningSummary = {
      scannedCount: courses.length,
      closedCount: 0,
      deletedCount: 0,
      reasons: {
        oembedDeleted: 0,
        oembedPrivate: 0,
        oembedInvalid: 0,
        httpNotFound: 0,
        contentRetired: 0,
      },
      items: [],
    };

    const closedCourseIdsToDelete: string[] = [];

    // Process in batches of 4
    const batchSize = 4;
    for (let i = 0; i < courses.length; i += batchSize) {
      const batch = courses.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (course) => {
          const evalResult = await this.evaluateCourse(course);
          if (evalResult.isClosed) {
            summary.closedCount++;

            if (evalResult.reasonCode === 'OEMBED_404_DELETED') summary.reasons.oembedDeleted++;
            else if (evalResult.reasonCode === 'OEMBED_401_PRIVATE') summary.reasons.oembedPrivate++;
            else if (evalResult.reasonCode === 'OEMBED_400_INVALID') summary.reasons.oembedInvalid++;
            else if (evalResult.reasonCode === 'HTTP_404_NOT_FOUND') summary.reasons.httpNotFound++;
            else if (evalResult.reasonCode === 'CONTENT_RETIRED') summary.reasons.contentRetired++;

            const item: CourseScreeningResultItem = {
              id: course.id,
              title: course.title,
              provider: course.provider,
              url: course.url,
              thumbnailUrl: course.thumbnailUrl,
              reason: evalResult.reason || 'คอร์สเรียนไม่พร้อมใช้งาน',
              reasonCode: evalResult.reasonCode || 'OEMBED_404_DELETED',
              actionTaken: params.dryRun ? 'PREVIEW_ONLY' : 'DELETED',
            };
            summary.items.push(item);

            if (!params.dryRun) {
              closedCourseIdsToDelete.push(course.id);
            }
          }
        }),
      );
    }

    // Execute deletions
    if (!params.dryRun && closedCourseIdsToDelete.length > 0) {
      for (const courseId of closedCourseIdsToDelete) {
        try {
          await this.prisma.course.delete({ where: { id: courseId } });
          summary.deletedCount++;
        } catch (err: any) {
          this.logger.error(`Failed to delete course ${courseId}: ${err.message}`);
        }
      }

      // Record Execution Audit Log
      const finishedAt = new Date();
      await this.prisma.ingestionLog.create({
        data: {
          source: 'COURSE_CLEANUP',
          status: IngestionStatus.SUCCESS,
          startedAt,
          finishedAt,
          createdCount: 0,
          updatedCount: 0,
          duplicateCount: summary.deletedCount, // Using duplicateCount column to track deleted
          errorCount: 0,
          errorMessage: null,
          metadata: JSON.stringify({
            scannedCount: summary.scannedCount,
            closedFound: summary.closedCount,
            deletedCount: summary.deletedCount,
            reasons: summary.reasons,
          }),
        },
      });

      this.logger.log(
        `[Course Screening Engine] Complete: Scanned ${summary.scannedCount}, Found Closed ${summary.closedCount}, Removed ${summary.deletedCount} courses.`,
      );
    } else {
      this.logger.log(
        `[Course Screening Preview] Complete: Scanned ${summary.scannedCount}, Found Closed ${summary.closedCount} courses (No database changes).`,
      );
    }

    return summary;
  }
}
