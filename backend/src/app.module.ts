import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma';
import { CacheModule } from './modules/cache';
import { RepositoryModule } from './modules/repository';
import { WebhookModule } from './modules/webhook';
import { SyncModule } from './modules/sync';
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
      redis: {
        host: process.env['REDIS_URL']?.replace('redis://', '').split(':')[0] ?? 'localhost',
        port: parseInt(
          process.env['REDIS_URL']?.replace('redis://', '').split(':')[1] ?? '6379',
          10,
        ),
      },
    }),

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
