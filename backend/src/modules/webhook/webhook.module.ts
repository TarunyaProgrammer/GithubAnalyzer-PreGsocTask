import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WebhookController } from './webhook.controller';
import { SyncModule } from '../sync';
import { SYNC_QUEUE_NAME } from '../sync/sync.service';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    SyncModule,
    BullModule.registerQueue({
      name: SYNC_QUEUE_NAME,
    }),
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
