import {
  Controller,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  Headers,
} from '@nestjs/common';
import type { Request } from 'express';
import { SyncService } from '../sync/sync.service';
import { PrismaService } from '../../prisma';
import { WebhookService } from './webhook.service';
import { WebhookSignatureGuard } from '../../common/guards';

interface WebhookPayload {
  action?: string;
  repository?: {
    full_name: string;
    name: string;
  };
}

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly syncService: SyncService,
    private readonly prisma: PrismaService,
    private readonly webhookService: WebhookService,
  ) {}

  @Post('github')
  @UseGuards(WebhookSignatureGuard)
  @HttpCode(HttpStatus.OK)
  async handleGitHubWebhook(
    @Req() req: Request,
    @Headers('x-github-event') eventType: string,
    @Headers('x-github-delivery') deliveryId: string,
  ): Promise<{ received: boolean; status: string }> {
    const payload = req.body as WebhookPayload;
    const repoFullName = payload.repository?.full_name;

    if (!deliveryId) {
      return { received: true, status: 'missing_delivery_id' };
    }

    if (!repoFullName) {
      return { received: true, status: 'ignored_no_repo' };
    }

    // 1. Deduplicate Event
    const isNew = await this.webhookService.deduplicateEvent(deliveryId);
    if (!isNew) {
      this.logger.debug(`Ignored duplicate webhook delivery: ${deliveryId}`);
      return { received: true, status: 'ignored_duplicate' };
    }

    this.logger.log(`Received webhook: event="${eventType}", repo="${repoFullName}"`);

    // 2. Queue for Processing
    // High priority for real-time triggered syncs
    await this.syncService.enqueueRepoSync(repoFullName, eventType, 1);

    return { received: true, status: 'queued' };
  }
}
