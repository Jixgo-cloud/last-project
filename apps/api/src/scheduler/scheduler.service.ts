import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IngestionService } from '../ingestion/ingestion.service';
import { JobScreeningService } from '../ingestion/job-screening.service';
import { CourseScreeningService } from '../ingestion/course-screening.service';
import { JobSource, CourseSource } from '@smartcareer/shared';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private ingestionService: IngestionService,
    private jobScreeningService: JobScreeningService,
    private courseScreeningService: CourseScreeningService,
  ) {}

  /**
   * Run automated Job Sync every day at Midnight (00:00:00 ICT)
   * Ingests live tech jobs across all platforms: JSearch, JobsDB, Blognone, JobThai, and Remotive.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'midnight-job-sync',
    timeZone: 'Asia/Bangkok',
  })
  async handleMidnightJobSyncCron() {
    this.logger.log('🌙 [Cron Scheduler] Executing automated Midnight Job Ingestion across all sources (Asia/Bangkok)...');
    
    const jobSources = [
      JobSource.JSEARCH,
      JobSource.JOBSDB,
      JobSource.BLOGNONE,
      JobSource.JOBTHAI,
      JobSource.REMOTIVE,
    ];

    for (const source of jobSources) {
      try {
        this.logger.log(`🌙 [Cron Scheduler] Syncing jobs from: ${source}`);
        await this.ingestionService.syncJobs(source);
      } catch (err: any) {
        this.logger.error(`🌙 [Cron Scheduler] Error syncing jobs for ${source}: ${err.message}`);
      }
    }

    this.logger.log('✅ [Cron Scheduler] Midnight Job Ingestion completed for all sources.');
  }

  /**
   * Run automated Course Sync every day at Midnight (00:00:00 ICT)
   * Ingests verified courses from Udemy and YouTube.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'midnight-course-sync',
    timeZone: 'Asia/Bangkok',
  })
  async handleMidnightCourseSyncCron() {
    this.logger.log('🌙 [Cron Scheduler] Executing automated Midnight Course Ingestion (Asia/Bangkok)...');
    
    const courseProviders = [CourseSource.UDEMY, CourseSource.YOUTUBE];

    for (const provider of courseProviders) {
      try {
        this.logger.log(`🌙 [Cron Scheduler] Syncing courses from: ${provider}`);
        await this.ingestionService.syncCourses(provider);
      } catch (err: any) {
        this.logger.error(`🌙 [Cron Scheduler] Error syncing courses for ${provider}: ${err.message}`);
      }
    }

    this.logger.log('✅ [Cron Scheduler] Midnight Course Ingestion completed for all providers.');
  }

  /**
   * Run automated Closed Job Cleanup daily at 00:30 ICT
   * Purges dead links (HTTP 404/410), expired deadlines, and positions that closed on source portals.
   */
  @Cron('30 0 * * *', {
    name: 'daily-closed-job-cleanup',
    timeZone: 'Asia/Bangkok',
  })
  async handleDailyClosedJobCleanupCron() {
    this.logger.log('🌙 [Cron Scheduler] Executing automated Closed Job Screening & Cleanup (Asia/Bangkok)...');
    try {
      const summary = await this.jobScreeningService.scanAndCleanJobs({
        source: 'ALL',
        limit: 300,
        deleteMode: 'DELETE',
      });
      this.logger.log(
        `✅ [Cron Scheduler] Closed Job Cleanup complete. Scanned: ${summary.scannedCount}, Removed: ${summary.deletedCount}`,
      );
    } catch (err: any) {
      this.logger.error(`❌ [Cron Scheduler] Error in automated Closed Job Cleanup: ${err.message}`);
    }
  }

  /**
   * Run automated Closed Course Cleanup daily at 00:35 ICT
   * Purges deleted YouTube videos (oEmbed 404/401/400) and retired Udemy courses.
   */
  @Cron('35 0 * * *', {
    name: 'daily-closed-course-cleanup',
    timeZone: 'Asia/Bangkok',
  })
  async handleDailyClosedCourseCleanupCron() {
    this.logger.log('🌙 [Cron Scheduler] Executing automated Closed Course Screening & Cleanup (Asia/Bangkok)...');
    try {
      const summary = await this.courseScreeningService.scanAndCleanCourses({
        provider: 'ALL',
        limit: 200,
        deleteMode: 'DELETE',
      });
      this.logger.log(
        `✅ [Cron Scheduler] Closed Course Cleanup complete. Scanned: ${summary.scannedCount}, Removed: ${summary.deletedCount}`,
      );
    } catch (err: any) {
      this.logger.error(`❌ [Cron Scheduler] Error in automated Closed Course Cleanup: ${err.message}`);
    }
  }
}
