import { Controller, Get, Post, Put, Query, Body, Param, UseGuards } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { IngestionConfigService } from './ingestion-config.service';
import { JobScreeningService } from './job-screening.service';
import { CourseScreeningService } from './course-screening.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, JobSource, CourseSource } from '@smartcareer/shared';

@Controller('ingestion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class IngestionController {
  constructor(
    private ingestionService: IngestionService,
    private configService: IngestionConfigService,
    private jobScreeningService: JobScreeningService,
    private courseScreeningService: CourseScreeningService,
  ) {}

  @Get('quotas')
  async getQuotas() {
    return this.configService.getQuotas();
  }

  @Put('quotas')
  async updateQuotas(@Body() body: Record<string, number>) {
    return this.configService.updateQuotas(body);
  }

  @Post('quotas/reset')
  async resetQuotas() {
    return this.configService.resetDefaults();
  }

  @Post('sync-jobs')
  async triggerJobsSync(
    @Query('source') source?: JobSource,
    @Query('limit') limit?: string,
  ) {
    return this.ingestionService.syncJobs(
      source || JobSource.REMOTIVE,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('job-runs')
  async startJobRun(@Body() body: { source?: JobSource; limit?: number; requestKey?: string }) {
    return this.ingestionService.startJobsRun(body.source || JobSource.REMOTIVE, body.limit, body.requestKey);
  }

  @Get('job-runs')
  async listJobRuns(@Query('requestKey') requestKey?: string) {
    return this.ingestionService.listJobsRuns(requestKey);
  }

  @Get('job-runs/:id')
  async getJobRun(@Param('id') id: string) {
    return this.ingestionService.getJobsRun(id);
  }

  @Post('sync-courses')
  async triggerCoursesSync(
    @Query('provider') provider?: CourseSource,
    @Query('limit') limit?: string,
    @Query('skillId') skillId?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.ingestionService.syncCourses(
      provider || CourseSource.YOUTUBE,
      limit ? parseInt(limit, 10) : undefined,
      skillId,
      keyword,
    );
  }

  @Post('backfill-course-skills')
  async backfillCourseSkills() {
    return this.ingestionService.backfillAllCourseSkills();
  }

  @Post('backfill-skills')
  async backfillSkills() {
    return this.ingestionService.backfillAllJobSkills();
  }

  @Post('enrich-jobs-ai')
  async enrichJobsAi(@Query('limit') limit?: string) {
    return this.ingestionService.enrichJobsWithAi(limit ? parseInt(limit, 10) : 20);
  }

  @Get('preview-closed-jobs')
  async previewClosedJobs(
    @Query('source') source?: JobSource | 'ALL',
    @Query('limit') limit?: string,
  ) {
    return this.jobScreeningService.previewClosedJobs(
      source,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Post('cleanup-closed-jobs')
  async cleanupClosedJobs(
    @Query('source') source?: JobSource | 'ALL',
    @Query('limit') limit?: string,
    @Body() body?: { deleteMode?: 'DELETE' | 'DEACTIVATE' },
  ) {
    return this.jobScreeningService.scanAndCleanJobs({
      source,
      limit: limit ? parseInt(limit, 10) : 200,
      deleteMode: body?.deleteMode || 'DEACTIVATE',
    });
  }

  @Get('preview-closed-courses')
  async previewClosedCourses(
    @Query('provider') provider?: CourseSource | 'ALL',
    @Query('limit') limit?: string,
  ) {
    return this.courseScreeningService.previewClosedCourses(
      provider,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Post('cleanup-closed-courses')
  async cleanupClosedCourses(
    @Query('provider') provider?: CourseSource | 'ALL',
    @Query('limit') limit?: string,
  ) {
    return this.courseScreeningService.scanAndCleanCourses({
      provider,
      limit: limit ? parseInt(limit, 10) : 200,
      deleteMode: 'DELETE',
    });
  }
}

