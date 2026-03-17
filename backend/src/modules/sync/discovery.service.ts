import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { GitHubService } from '../github';
import { PrismaService } from '../../prisma';
import { SyncService } from './sync.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DiscoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DiscoveryService.name);
  private readonly org: string;

  constructor(
    private readonly github: GitHubService,
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
    private readonly config: ConfigService,
  ) {
    this.org = this.config.get<string>('GITHUB_ORG', 'c2siorg');
  }

  onApplicationBootstrap() {
    this.logger.log(
      'Application started — triggering initial repository discovery...',
    );
    // Run discovery in background so it doesn't block startup
    void this.discoverAndEnqueue();
  }

  /**
   * Fetch all repositories from the org and ensure they exist in the database.
   * Then enqueue sync jobs for them.
   */
  async discoverAndEnqueue(): Promise<void> {
    try {
      this.logger.log(`Starting repository discovery for org: "${this.org}"`);
      
      const remoteRepos = await this.github.listOrgRepos();
      this.logger.log(
        `Found ${remoteRepos.length} public repositories in "${this.org}"`,
      );

      let newCount = 0;
      let updatedCount = 0;

      for (const repo of remoteRepos) {
        // We use the GitHub database ID as our primary key (BigInt)
        const dbRepo = await this.prisma.repository.upsert({
          where: { id: BigInt(repo.id) },
          create: {
            id: BigInt(repo.id),
            name: repo.name,
            fullName: repo.full_name,
            htmlUrl: `https://github.com/${repo.full_name}`,
            starsCount: 0, // Will be updated by full sync
            forksCount: 0,
            openIssuesCount: 0,
            isActive: true,
            syncedAt: new Date(0), // Mark as never fully synced
            githubCreatedAt: new Date(), // Placeholder, updated by full sync
            defaultBranch: 'main',
          },
          update: {
            isActive: true, // Ensure it stays active if it exists
          },
        });

        // If it's never been synced or was synced very long ago, enqueue it
        const neverSynced = dbRepo.syncedAt.getTime() === 0;
        
        if (neverSynced) {
          await this.sync.enqueueRepoSync(
            repo.full_name,
            'discovery-initial',
            5,
          );
          newCount++;
        } else {
          updatedCount++;
        }
      }

      this.logger.log(
        `Discovery complete: ${newCount} new repos enqueued, ${updatedCount} existing repos verified.`,
      );
    } catch (err) {
      this.logger.error(
        `Repository discovery failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
