import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CandidateModule } from './candidate/candidate.module';
import { CompanyModule } from './company/company.module';
import { AdminModule } from './admin/admin.module';
import { SkillsModule } from './skills/skills.module';
import { GithubModule } from './github/github.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { JobsModule } from './jobs/jobs.module';
import { MatchingModule } from './matching/matching.module';
import { ApplicationsModule } from './applications/applications.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(__dirname, '../.env'),
        path.resolve(__dirname, '../../../.env'),
      ],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    CandidateModule,
    CompanyModule,
    AdminModule,
    SkillsModule,
    GithubModule,
    AssessmentsModule,
    JobsModule,
    MatchingModule,
    ApplicationsModule,
    EvaluationsModule,
    RecommendationsModule,
    IngestionModule,
    SchedulerModule,
    NotificationsModule,
  ],
})
export class AppModule {}
