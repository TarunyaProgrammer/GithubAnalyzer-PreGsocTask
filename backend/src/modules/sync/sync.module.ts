import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { GitHubModule } from '../github';
import { AnalyzerModule } from '../analyzer';
import { SyncService, SYNC_QUEUE_NAME } from './sync.service';
import { SyncProcessor } from './sync.processor';
import { ProcessingService } from './processing.service';
import { SyncScheduler } from './sync.scheduler';

@Module({
  imports: [
    BullModule.registerQueue({
      name: SYNC_QUEUE_NAME,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
    ScheduleModule.forRoot(),
    GitHubModule,
    AnalyzerModule,
  ],
  providers: [SyncService, SyncProcessor, ProcessingService, SyncScheduler],
  exports: [SyncService],
})
export class SyncModule {}
