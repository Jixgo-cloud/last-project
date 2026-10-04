import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { Public, Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { JobType, JobSource, UserRole } from '@smartcareer/shared';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Controller('jobs')
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getAll(
    @Query('keyword') keyword?: string,
    @Query('location') location?: string,
    @Query('isRemote') isRemote?: string,
    @Query('employmentType') employmentType?: JobType,
    @Query('source') source?: JobSource,
    @Query('career') career?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ) {
    const candidateUserId = req?.user?.role === UserRole.CANDIDATE ? req.user.id : undefined;

    return this.jobsService.findAll({
      keyword,
      location,
      isRemote: isRemote !== undefined ? isRemote === 'true' : undefined,
      employmentType,
      source,
      career,
      sortBy,
      page: Math.max(1, Math.min(10000, Math.floor(Number(page)) || 1)),
      limit: Math.max(1, Math.min(100, Math.floor(Number(limit)) || 20)),
      candidateUserId,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Get('favorites/me')
  async getFavorites(@Request() req: any) {
    return this.jobsService.getFavorites(req.user.id);
  }

  @Public()
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/detail')
  async getOneWithAuth(@Param('id') id: string, @Request() req: any) {
    return this.jobsService.findOne(id, req.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/match')
  async getMatchScore(@Param('id') id: string, @Request() req: any) {
    return this.jobsService.getMatchScore(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post(':id/favorite')
  async toggleFavorite(@Param('id') id: string, @Request() req: any) {
    return this.jobsService.toggleFavorite(req.user.id, id);
  }
}

