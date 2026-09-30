import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { GithubService } from './github.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, Public } from '../auth/roles.decorator';
import { UserRole } from '@smartcareer/shared';

@Controller('github')
export class GithubController {
  constructor(private githubService: GithubService) {}

  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CANDIDATE)
  async syncRepositories(@Request() req: any, @Body() body: { username: string }) {
    return this.githubService.syncCandidateGithub(req.user.id, body.username);
  }

  @Public()
  @Get('public/:username')
  async publicAnalyze(@Param('username') username: string) {
    return this.githubService.publicAnalyze(username);
  }
}
