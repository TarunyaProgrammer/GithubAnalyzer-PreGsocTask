import {
  Controller,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { WebhookSignatureGuard } from '../../common/guards';
import { SyncService } from '../sync/sync.service';
import { PrismaService } from '../../prisma';

interface WebhookPayload {
  action?: string;
  repository?: {
    full_name: string;
    name: string;
  };
}

// Events we handle
const HANDLED_EVENTS = new Set([
  'push',
  'release',
  'pull_request',
  'issues',
  'create',
  'delete',
  'fork',
  'star',
  'repository',
]);

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly syncService: SyncService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /webhooks/github
   * Receives GitHub webhook events.
   * Returns 200 immediately, processes asynchronously.
   */
  @Post('github')
  @UseGuards(WebhookSignatureGuard)
  @HttpCode(HttpStatus.OK)
  async handleGitHubWebhook(@Req() req: Request): Promise<{ received: boolean }> {
    const eventType = req.headers['x-github-event'] as string;
    const payload = req.body as WebhookPayload;
    const repoFullName = payload.repository?.full_name;

    this.logger.log(`Received webhook: event="${eventType}", repo="${repoFullName}"`);

    // Return 200 immediately — process async
    // (NestJS will still wait for this handler to resolve, but that's fine
    // because we just enqueue a job, which is sub-ms)

    if (!repoFullName) {
      this.logger.warn(`Webhook missing repository info — event: ${eventType}`);
      return { received: true };
    }

    if (!HANDLED_EVENTS.has(eventType)) {
      this.logger.log(`Ignoring unhandled event: ${eventType}`);
      return { received: true };
    }

    // Handle repository.deleted event — soft delete
    if (eventType === 'repository' && payload.action === 'deleted') {
      this.logger.log(`Repository deleted: ${repoFullName} — marking as inactive`);
      await this.prisma.repository.updateMany({
        where: { fullName: repoFullName },
        data: { isActive: false },
      });
      return { received: true };
    }

    // Handle repository.archived event
    if (eventType === 'repository' && payload.action === 'archived') {
      this.logger.log(`Repository archived: ${repoFullName}`);
    }

    // Enqueue sync job (high priority for webhook-triggered events)
    await this.syncService.enqueueRepoSync(repoFullName, eventType, 1);

    return { received: true };
  }
}
