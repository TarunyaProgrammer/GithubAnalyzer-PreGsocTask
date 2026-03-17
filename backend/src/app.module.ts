import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma';
import { CacheModule } from './modules/cache';
import { RepositoryModule } from './modules/repository';
import { WebhookModule } from './modules/webhook';
import { SyncModule } from './modules/sync';
import { HealthModule } from './modules/health/health.module';
import { validate } from './config';

@Module({
  imports: [
    // Config — validate env vars on startup
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env', // Load from project root
      validate,
    }),

    // BullMQ — Redis-backed job queue
    BullModule.forRoot({
      url: process.env['REDIS_URL'] || 'redis://localhost:6379',
    }),

    // Health Check
    HealthModule,

    // Database
    PrismaModule,

    // Cache (L1 + L2)
    CacheModule,

    // Feature modules
    RepositoryModule,
    WebhookModule,
    SyncModule,
  ],
})
export class AppModule {}
