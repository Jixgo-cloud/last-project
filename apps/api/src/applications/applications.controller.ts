import { Controller, Post, Get, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@smartcareer/shared';

@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(private applicationsService: ApplicationsService) {}

  @Roles(UserRole.CANDIDATE)
  @Post(':jobId/apply')
  async applyJob(
    @Request() req: any,
    @Param('jobId') jobId: string,
    @Body() body: { coverLetter?: string; resumeUrl?: string },
  ) {
    return this.applicationsService.applyJob(req.user.id, jobId, body);
  }

  @Roles(UserRole.CANDIDATE)
  @Delete(':id')
  async cancelApplication(@Request() req: any, @Param('id') id: string) {
    return this.applicationsService.cancelApplication(req.user.id, id);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.applicationsService.getApplicationById(id);
  }
}

