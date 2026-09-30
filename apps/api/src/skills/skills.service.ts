import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SkillCategory } from '@smartcareer/shared';

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.skill.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findByCategory(category: SkillCategory) {
    return this.prisma.skill.findMany({
      where: { category },
      orderBy: { name: 'asc' },
    });
  }

  async getFrameworks() {
    return this.prisma.skillFramework.findMany({
      include: {
        items: {
          include: { skill: true },
        },
      },
    });
  }
}
