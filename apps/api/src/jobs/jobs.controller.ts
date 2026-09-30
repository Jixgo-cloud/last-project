import { Controller, Get, Post, Param, Query, UseGuards, Request, Headers } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { Public, Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { JobType, JobSource, UserRole } from '@smartcareer/shared';

@Controller('jobs')
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Public()
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
    @Headers('authorization') authHeader?: string,
  ) {
    let candidateUserId: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const base64Payload = token.split('.')[1];
        if (base64Payload) {
          const decodedJson = Buffer.from(base64Payload, 'base64').toString('utf-8');
          const payload = JSON.parse(decodedJson);
          if (!payload.exp || payload.exp * 1000 > Date.now()) {
            candidateUserId = payload.sub;
          }
        }
      } catch {
        // ignore invalid/expired tokens for public search
      }
    }

    return this.jobsService.findAll({
      keyword,
      location,
      isRemote: isRemote !== undefined ? isRemote === 'true' : undefined,
      employmentType,
      source,
      career,
      sortBy,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
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

