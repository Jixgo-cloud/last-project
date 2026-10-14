import { Controller, Get, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, Public } from '../auth/roles.decorator';
import { UserRole, CourseSource } from '@smartcareer/shared';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private recommendationsService: RecommendationsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Patch('development-plan/:evaluationId/skills/:skillId/progress')
  async updateProgress(@Request() req: any, @Param('evaluationId') evaluationId: string, @Param('skillId') skillId: string, @Body() body: any) {
    return this.recommendationsService.updateLearningProgress(req.user.id, evaluationId, skillId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Get('development-plan')
  async getDevelopmentPlan(@Request() req: any) {
    return this.recommendationsService.getDevelopmentPlan(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Get('skill-gaps')
  async getSkillGaps(@Request() req: any) {
    return this.recommendationsService.getSkillGapsAndRecommendations(req.user.id);
  }

  @Public()
  @Get('courses')
  async getAllCourses(
    @Query('keyword') keyword?: string,
    @Query('provider') provider?: CourseSource,
    @Query('career') career?: string,
    @Query('skillId') skillId?: string,
  ) {
    return this.recommendationsService.getAllCourses({
      keyword,
      provider,
      career,
      skillId,
    });
  }
}
