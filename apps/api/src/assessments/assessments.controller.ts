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

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.assessmentsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/start')
  async startAttempt(@Param('id') id: string, @Request() req: any) {
    return this.assessmentsService.startAttempt(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/run-code')
  async runCode(
    @Request() req: any,
    @Body() body: { questionId: string; sourceCode: string },
  ) {
    return this.assessmentsService.testRunCode(body.questionId, req.user.id, body.sourceCode);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/autosave')
  async autosave(
    @Request() req: any,
    @Body() body: { attemptId: string; draftCode: Record<string, string> },
  ) {
    return this.assessmentsService.saveDraftCode(body.attemptId, req.user.id, body.draftCode);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/integrity-event')
  async logIntegrityEvent(
    @Request() req: any,
    @Body() body: { attemptId: string; event: { type: string; timestamp?: string; details?: any } },
  ) {
    return this.assessmentsService.logIntegrityEvent(body.attemptId, req.user.id, body.event);
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
    return this.assessmentsService.submitTheoryAttempt(
      body.attemptId,
      req.user.id,
      body.answers,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/submit-coding')
  async submitCoding(
    @Request() req: any,
    @Body() body: { attemptId: string; questionId: string; sourceCode: string },
  ) {
    return this.assessmentsService.submitCodingSolution(
      body.attemptId,
      body.questionId,
      req.user.id,
      body.sourceCode,
    );
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
