import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma';

export interface SyncJobPayload {
  repoFullName: string;
  repoName: string;
  eventType: string;
  priority: number;
}

export const SYNC_QUEUE_NAME = 'repository-sync';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectQueue(SYNC_QUEUE_NAME) private readonly syncQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enqueue a single repo for sync.
   */
  async enqueueRepoSync(
    fullName: string,
    eventType: string,
    priority: number = 5,
  ): Promise<void> {
    const repoName = fullName.split('/').pop() ?? fullName;

    const payload: SyncJobPayload = {
      repoFullName: fullName,
      repoName,
      eventType,
      priority,
    };

    await this.syncQueue.add('sync-repo', payload, {
      priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50, // Keep last 50 failed jobs
    });

    this.logger.log(`Enqueued sync for "${fullName}" (event: ${eventType})`);
  }

  /**
   * Enqueue ALL active repos for sync (used by daily full reconciliation).
   */
  async enqueueAllRepos(): Promise<void> {
    const repos = await this.prisma.repository.findMany({
      where: { isActive: true },
      select: { fullName: true },
    });

    this.logger.log(`Enqueueing full sync for ${repos.length} repos`);

    for (const repo of repos) {
      await this.enqueueRepoSync(repo.fullName, 'scheduled-full', 10);
    }
  }

  /**
   * Enqueue only stale repos (syncedAt > 6 hours ago).
   * Used by the incremental cron job.
   */
  async enqueueStaleRepos(): Promise<void> {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const staleRepos = await this.prisma.repository.findMany({
      where: {
        isActive: true,
        syncedAt: { lt: sixHoursAgo },
      },
      select: { fullName: true },
    });

    this.logger.log(
      `Found ${staleRepos.length} stale repos (>6h since last sync)`,
    );

    for (const repo of staleRepos) {
      await this.enqueueRepoSync(repo.fullName, 'scheduled-incremental', 8);
    }
  }

  /**
   * Get queue stats for monitoring.
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.syncQueue.getWaitingCount(),
      this.syncQueue.getActiveCount(),
      this.syncQueue.getCompletedCount(),
      this.syncQueue.getFailedCount(),
      this.syncQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}
