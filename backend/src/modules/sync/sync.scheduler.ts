import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SyncService } from './sync.service';
import { GitHubService } from '../github';
import { DiscoveryService } from './discovery.service';

@Injectable()
export class SyncScheduler {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    private readonly syncService: SyncService,
    private readonly githubService: GitHubService,
    private readonly discoveryService: DiscoveryService,
  ) {}

  /**
   * Every 12 hours: Discover new repositories in the organization.
   */
  @Cron('0 */12 * * *')
  async discoverRepos(): Promise<void> {
    this.logger.log('Starting scheduled repository discovery');
    await this.discoveryService.discoverAndEnqueue();
  }

  /**
   * Every 6 hours: sync repos whose syncedAt is older than 6 hours.
   */
  @Cron('0 */6 * * *')
  async incrementalSync(): Promise<void> {
    this.logger.log('Starting incremental sync (stale repos only)');

    if (this.githubService.isCircuitBreakerOpen()) {
      this.logger.warn('Circuit breaker open — skipping incremental sync');
      return;
    }

    await this.syncService.enqueueStaleRepos();
  }

  /**
   * Daily at 2am: full reconciliation — sync all repos.
   */
  @Cron('0 2 * * *')
  async fullSync(): Promise<void> {
    this.logger.log('Starting daily full sync');

    if (this.githubService.isCircuitBreakerOpen()) {
      this.logger.warn('Circuit breaker open — skipping full sync');
      return;
    }

    await this.syncService.enqueueAllRepos();
  }
}
