import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@smartcareer/shared';

@Controller('evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationsController {
  constructor(private evaluationsService: EvaluationsService) {}

  @Roles(UserRole.COMPANY)
  @Post(':applicationId')
  async evaluate(
    @Request() req: any,
    @Param('applicationId') applicationId: string,
    @Body() body: any,
  ) {
    return this.evaluationsService.evaluateCandidate(req.user.id, applicationId, body);
  }

  @Roles(UserRole.CANDIDATE)
  @Get('my-feedback')
  async getMyFeedback(@Request() req: any) {
    return this.evaluationsService.getCandidateEvaluations(req.user.id);
  }
}
