import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CompanyService } from './company.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, ApplicationStatus } from '@smartcareer/shared';

@Controller('company')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
export class CompanyController {
  constructor(private companyService: CompanyService) {}

  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.companyService.getCompanyByUserId(req.user.id);
  }

  @Put('profile')
  async updateProfile(@Request() req: any, @Body() body: any) {
    return this.companyService.updateProfile(req.user.id, body);
  }

  @Post('verify')
  async submitVerification(
    @Request() req: any,
    @Body() body: { businessRegNo: string; documents?: any },
  ) {
    return this.companyService.submitVerification(req.user.id, body.businessRegNo, body.documents);
  }

  @Post('jobs')
  async createJob(@Request() req: any, @Body() body: any) {
    return this.companyService.createJob(req.user.id, body);
  }

  @Patch('jobs/:id/toggle')
  async toggleJob(@Request() req: any, @Param('id') id: string) {
    return this.companyService.toggleJobStatus(req.user.id, id);
  }

  @Delete('jobs/:id')
  async deleteJob(@Request() req: any, @Param('id') id: string) {
    return this.companyService.deleteJob(req.user.id, id);
  }

  @Get('applications')
  async getApplications(@Request() req: any, @Query('jobId') jobId?: string) {
    return this.companyService.getApplications(req.user.id, jobId);
  }

  @Get('applications/export')
  async exportApplications(
    @Request() req: any,
    @Res() res: Response,
    @Query('jobId') jobId?: string,
  ) {
    const csv = await this.companyService.exportApplicationsCsv(req.user.id, jobId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="smartcareer_applicants_${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return res.send(csv);
  }

  @Put('applications/:id/status')
  async updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { status: ApplicationStatus; note?: string },
  ) {
    return this.companyService.updateApplicationStatus(req.user.id, id, body.status, body.note);
  }

  @Get('candidates/:candidateId')
  async getCandidateProfile(
    @Request() req: any,
    @Param('candidateId') candidateId: string,
  ) {
    return this.companyService.getCandidateProfile(req.user.id, candidateId);
  }

  // --- Company Custom Assessments ---
  @Get('assessments')
  async listCompanyAssessments(@Request() req: any) {
    return this.companyService.listCompanyAssessments(req.user.id);
  }

  @Get('assessments/:id')
  async getCompanyAssessment(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.companyService.getCompanyAssessmentDetail(req.user.id, id);
  }

  @Post('assessments')
  async createCompanyAssessment(@Request() req: any, @Body() body: any) {
    return this.companyService.createCompanyAssessment(req.user.id, body);
  }

  @Put('assessments/:id')
  async updateCompanyAssessment(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.companyService.updateCompanyAssessment(req.user.id, id, body);
  }

  @Patch('assessments/:id/toggle')
  async toggleCompanyAssessment(@Request() req: any, @Param('id') id: string) {
    return this.companyService.toggleCompanyAssessment(req.user.id, id);
  }

  @Delete('assessments/:id')
  async deleteCompanyAssessment(@Request() req: any, @Param('id') id: string) {
    return this.companyService.deleteCompanyAssessment(req.user.id, id);
  }

  @Get('assessment-attempts')
  async listAssessmentAttempts(
    @Request() req: any,
    @Query('assessmentId') assessmentId?: string,
  ) {
    return this.companyService.listCompanyAssessmentAttempts(req.user.id, assessmentId);
  }
}
