import { Controller, Get, Query } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { Public } from '../auth/roles.decorator';
import { SkillCategory } from '@smartcareer/shared';

@Controller('skills')
export class SkillsController {
  constructor(private skillsService: SkillsService) {}

  @Public()
  @Get()
  async getAll(@Query('category') category?: SkillCategory) {
    if (category) {
      return this.skillsService.findByCategory(category);
    }
    return this.skillsService.findAll();
  }

  @Public()
  @Get('frameworks')
  async getFrameworks() {
    return this.skillsService.getFrameworks();
  }
}
