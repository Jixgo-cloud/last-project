import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { CandidateModule } from '../candidate/candidate.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [CandidateModule, NotificationsModule],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}

