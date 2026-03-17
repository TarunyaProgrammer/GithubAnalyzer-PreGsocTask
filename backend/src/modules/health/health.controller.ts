import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      // Ping the database
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
    } catch (error) {
      return { 
        status: 'error', 
        database: 'disconnected', 
        message: (error as Error).message,
        timestamp: new Date().toISOString() 
      };
    }
  }
}
