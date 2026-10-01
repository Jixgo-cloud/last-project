import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, VerificationStatus } from '@smartcareer/shared';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('verifications')
  async listVerifications(@Query('status') status?: VerificationStatus) {
    return this.adminService.listVerifications(status);
  }

  @Put('verifications/:id/review')
  async reviewVerification(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { action: 'APPROVE' | 'REJECT'; reason?: string },
  ) {
    return this.adminService.reviewVerification(id, req.user.id, body.action, body.reason);
  }

  @Get('users')
  async listUsers() {
    return this.adminService.listUsers();
  }

  @Get('skills')
  async listSkills() {
    return this.adminService.listSkills();
  }

  @Post('skills')
  async createSkill(@Body() body: any) {
    return this.adminService.createSkill(body);
  }

  @Get('frameworks')
  async listFrameworks() {
    return this.adminService.listFrameworks();
  }

  @Get('ingestion-logs')
  async listIngestionLogs() {
    return this.adminService.listIngestionLogs();
  }

  // --- Assessment Management ---
  @Get('assessments')
  async listAssessments() {
    return this.adminService.listAssessments();
  }

  @Get('assessments/:id')
  async getAssessment(@Param('id') id: string) {
    return this.adminService.getAssessment(id);
  }

  @Post('assessments')
  async createAssessment(@Body() body: any) {
    return this.adminService.createAssessment(body);
  }

  @Put('assessments/:id')
  async updateAssessment(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateAssessment(id, body);
  }

  @Patch('assessments/:id/toggle')
  async toggleAssessment(@Param('id') id: string) {
    return this.adminService.toggleAssessment(id);
  }

  @Delete('assessments/:id')
  async deleteAssessment(@Param('id') id: string) {
    return this.adminService.deleteAssessment(id);
  }

  @Get('assessments/:id/attempts')
  async listAssessmentAttempts(@Param('id') id: string) {
    return this.adminService.listAssessmentAttempts(id);
  }
}
