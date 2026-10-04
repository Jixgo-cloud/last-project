import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, Public } from '../auth/roles.decorator';
import { UserRole } from '@smartcareer/shared';

@Controller('assessments')
export class AssessmentsController {
  constructor(private assessmentsService: AssessmentsService) {}

  @Public()
  @Get()
  async getAll() {
    return this.assessmentsService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Get('my-attempts')
  async getMyAttempts(@Request() req: any) {
    return this.assessmentsService.getCandidateAttempts(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Get('my-badges')
  async getMyBadges(@Request() req: any) {
    return this.assessmentsService.getCandidateBadges(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Get(':id')
  async getOne(@Param('id') id: string, @Request() req: any) {
    return this.assessmentsService.findOne(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/start')
  async startAttempt(@Param('id') id: string, @Request() req: any) {
    const result = await this.assessmentsService.startAttempt(id, req.user.id);
    return this.assessmentsService.discloseCandidateResponse(result, result.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/run-code')
  async runCode(
    @Param('id') assessmentId: string,
    @Request() req: any,
    @Body() body: { attemptId: string; questionId: string; sourceCode: string },
  ) {
    return this.assessmentsService.testRunCode(
      assessmentId,
      body.attemptId,
      body.questionId,
      req.user.id,
      body.sourceCode,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/autosave')
  async autosave(
    @Request() req: any,
    @Body() body: {
      attemptId: string;
      draftCode: Record<string, string> | {
        codes: Record<string, string>;
        selectedChoices: Record<string, string>;
      };
    },
  ) {
    const result = await this.assessmentsService.saveDraftCode(body.attemptId, req.user.id, body.draftCode);
    return this.assessmentsService.discloseCandidateResponse(result, body.attemptId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/integrity-event')
  async logIntegrityEvent(
    @Request() req: any,
    @Body() body: { attemptId: string; event: { type: string; timestamp?: string; details?: any } },
  ) {
    const result = await this.assessmentsService.logIntegrityEvent(body.attemptId, req.user.id, body.event);
    return this.assessmentsService.discloseCandidateResponse(result, body.attemptId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/submit-theory')
  async submitTheory(
    @Request() req: any,
    @Body()
    body: {
      attemptId: string;
      answers: Array<{ questionId: string; selectedChoiceId: string }>;
    },
  ) {
    const result = await this.assessmentsService.submitTheoryAttempt(
      body.attemptId,
      req.user.id,
      body.answers,
    );
    return this.assessmentsService.discloseCandidateResponse(result, body.attemptId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/submit-coding')
  async submitCoding(
    @Request() req: any,
    @Body() body: { attemptId: string; questionId: string; sourceCode: string },
  ) {
    const result = await this.assessmentsService.submitCodingSolution(
      body.attemptId,
      body.questionId,
      req.user.id,
      body.sourceCode,
    );
    return this.assessmentsService.discloseCandidateResponse(result, body.attemptId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/finalize-attempt')
  async finalizeAttempt(
    @Request() req: any,
    @Body() body: { attemptId: string },
  ) {
    const result = await this.assessmentsService.finalizeAttempt(body.attemptId, req.user.id);
    return this.assessmentsService.discloseCandidateResponse(result, body.attemptId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('attempts/:attemptId/review')
  async getAttemptReview(
    @Param('attemptId') attemptId: string,
    @Request() req: any,
  ) {
    return this.assessmentsService.getAttemptReviewDetails(attemptId, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY, UserRole.ADMIN)
  @Post('attempts/:attemptId/override-score')
  async overrideScore(
    @Param('attemptId') attemptId: string,
    @Request() req: any,
    @Body() body: { humanScore: number; reviewReason: string },
  ) {
    return this.assessmentsService.overrideAttemptScore(
      attemptId,
      req.user.id,
      body.humanScore,
      body.reviewReason,
    );
  }
}
