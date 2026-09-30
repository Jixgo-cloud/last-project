import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';
import { GeminiExtractorService } from './gemini-extractor.service';
import { JobScreeningService } from './job-screening.service';
import { CourseScreeningService } from './course-screening.service';
import { IngestionConfigService } from './ingestion-config.service';

@Module({
  controllers: [IngestionController],
  providers: [
    IngestionService,
    GeminiExtractorService,
    JobScreeningService,
    CourseScreeningService,
    IngestionConfigService,
  ],
  exports: [
    IngestionService,
    GeminiExtractorService,
    JobScreeningService,
    CourseScreeningService,
    IngestionConfigService,
  ],
})
export class IngestionModule {}

