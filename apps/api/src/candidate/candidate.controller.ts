import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { CandidateService } from './candidate.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@smartcareer/shared';

@Controller('candidate')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CandidateController {
  constructor(private candidateService: CandidateService) {}

  @Get('profile')
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN)
  async getProfile(@Request() req: any) {
    return this.candidateService.getProfile(req.user.id);
  }

  @Put('profile')
  @Roles(UserRole.CANDIDATE)
  async updateProfile(@Request() req: any, @Body() body: any) {
    return this.candidateService.updateProfile(req.user.id, body);
  }

  @Get('radar')
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN)
  async getRadar(@Request() req: any) {
    return this.candidateService.getRadarData(req.user.id);
  }

  @Get('applications')
  @Roles(UserRole.CANDIDATE)
  async getApplications(@Request() req: any) {
    return this.candidateService.getCandidateApplications(req.user.id);
  }
}
