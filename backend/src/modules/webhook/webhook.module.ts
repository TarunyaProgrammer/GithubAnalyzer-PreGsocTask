import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { SyncModule } from '../sync';

@Module({
  imports: [SyncModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
