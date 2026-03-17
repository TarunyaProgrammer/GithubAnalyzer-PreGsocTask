import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../prisma';
import { GitHubService } from '../github';
import { CacheService, CACHE_KEYS } from '../cache';
import { AnalyzerService } from '../analyzer';
import { ConfigService } from '@nestjs/config';
import { ProcessingService } from './processing.service';
import { SyncJobPayload, SYNC_QUEUE_NAME } from './sync.service';

@Processor(SYNC_QUEUE_NAME)
export class SyncProcessor {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GitHubService,
    private readonly cache: CacheService,
    private readonly processing: ProcessingService,
    private readonly analyzer: AnalyzerService,
    private readonly configService: ConfigService,
  ) {}

  @Process('sync-repo')
  async handleSyncJob(job: Job<SyncJobPayload>): Promise<void> {
    const { repoName, repoFullName, eventType } = job.data;
    const org = this.configService.get<string>('GITHUB_ORG', 'c2siorg');
    this.logger.log(
      `Processing sync job: ${repoFullName} (event: ${eventType})`,
    );

    try {
      // 1. Fetch repo metadata via GraphQL
      const repoData = await this.github.fetchSingleRepo(repoName);
      if (!repoData) {
        this.logger.warn(`Repo "${repoName}" not found on GitHub — skipping`);
        return;
      }

      // 2. Fetch contributors via REST (ETag cached)
      const contributors = await this.github.fetchContributors(repoName);

      // 3. Fetch languages via REST (ETag cached)
      const languages = await this.github.fetchLanguages(repoName);

      // 4. Fetch commit activity via REST
      const activity = await this.github.fetchCommitActivity(repoName);

      // 5. Process all data
      const repoUpsert = this.processing.processRepository(repoData);
      // Fix fullName using the org
      const orgPrefix = repoFullName.includes('/')
        ? repoFullName.split('/')[0]
        : org;
      (repoUpsert.create as Record<string, unknown>)['fullName'] =
        `${orgPrefix}/${repoData.name}`;

      const repoId = BigInt(repoData.databaseId);
      const { contributorUpserts, joinUpserts } =
        this.processing.processContributors(repoId, contributors);
      const languagePayloads = this.processing.processLanguages(
        repoId,
        languages,
      );
      const activityPayloads = this.processing.processCommitActivity(
        repoId,
        activity,
      );

      // 6. Upsert everything in a transaction
      await this.prisma.$transaction(async (tx) => {
        // Upsert repository
        await tx.repository.upsert(repoUpsert);

        // Upsert contributors
        for (const upsert of contributorUpserts) {
          await tx.contributor.upsert(upsert);
        }

        // Delete existing join records and re-create
        await tx.repositoryContributor.deleteMany({
          where: { repositoryId: repoId },
        });
        if (joinUpserts.length > 0) {
          await tx.repositoryContributor.createMany({
            data: joinUpserts,
            skipDuplicates: true,
          });
        }

        // Delete existing languages and re-create
        await tx.repositoryLanguage.deleteMany({
          where: { repositoryId: repoId },
        });
        if (languagePayloads.length > 0) {
          await tx.repositoryLanguage.createMany({
            data: languagePayloads,
            skipDuplicates: true,
          });
        }

        // Delete existing activity and re-create
        await tx.commitActivity.deleteMany({
          where: { repositoryId: repoId },
        });
        if (activityPayloads.length > 0) {
          await tx.commitActivity.createMany({
            data: activityPayloads,
            skipDuplicates: true,
          });
        }
      });

      // 7. Invalidate cache
      await Promise.all([
        this.cache.del(CACHE_KEYS.repo(repoId)),
        this.cache.del(CACHE_KEYS.contributors(repoId)),
        this.cache.del(CACHE_KEYS.languages(repoId)),
        this.cache.del(CACHE_KEYS.activity(repoId)),
        this.cache.del(CACHE_KEYS.stats()),
        this.cache.delPattern('repo:list:*'),
        this.cache.delPattern('repo:search:*'),
      ]);

      this.logger.log(
        `Synced "${repoFullName}": ${contributors.length} contributors, ` +
          `${languagePayloads.length} languages, ${activityPayloads.length} weeks activity`,
      );

      // 8. Run analyzer scores
      await this.analyzer.analyzeAndSave(repoId);
    } catch (err) {
      this.logger.error(
        `Failed to sync "${repoFullName}": ${(err as Error).message}`,
      );
      throw err; // Let BullMQ handle retry
    }
  }
}
