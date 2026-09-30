import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/roles.decorator';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async getHealth(@Res() res: Response) {
    try {
      // Readiness probe: check live database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(503).json({
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
        message: err.message || 'Database connection check failed',
      });
    }
  }

  @Public()
  @Get('ready')
  async getReadiness(@Res() res: Response) {
    return this.getHealth(res);
  }
}
