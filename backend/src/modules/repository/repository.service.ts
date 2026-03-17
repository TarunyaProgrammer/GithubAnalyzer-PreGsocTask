import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { SyncService } from '../sync/sync.service';
import { AnalyzerService, AnalysisResult } from '../analyzer/analyzer.service';
import { CacheService, CACHE_KEYS, CACHE_TTLS } from '../cache';
import {
  RepoQueryDto,
  RepositoryResponseDto,
  ContributorResponseDto,
  LanguageResponseDto,
  CommitActivityResponseDto,
  PaginatedResponseDto,
  StatsResponseDto,
  AnalysisReportResponseDto,
} from './repository.dto';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class RepositoryService {
  private readonly logger = new Logger(RepositoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly sync: SyncService,
    private readonly analyzer: AnalyzerService,
  ) {}

  /**
   * Convert a Prisma repository to a response DTO.
   */
  private toDto(repo: Record<string, unknown>): RepositoryResponseDto {
    return {
      id: String(repo['id']),
      name: repo['name'] as string,
      fullName: repo['fullName'] as string,
      description: (repo['description'] as string) ?? null,
      htmlUrl: repo['htmlUrl'] as string,
      starsCount: repo['starsCount'] as number,
      forksCount: repo['forksCount'] as number,
      openIssuesCount: repo['openIssuesCount'] as number,
      isArchived: repo['isArchived'] as boolean,
      activityScore: (repo['activityScore'] as number) ?? null,
      complexityScore: (repo['complexityScore'] as number) ?? null,
      learningDifficulty: (repo['learningDifficulty'] as string) ?? null,
      primaryLanguage: (repo['primaryLanguage'] as string) ?? null,
      topics: (repo['topics'] as string[]) ?? [],
      licenseName: (repo['licenseName'] as string) ?? null,
      defaultBranch: repo['defaultBranch'] as string,
      lastPushedAt: repo['lastPushedAt']
        ? (repo['lastPushedAt'] as Date).toISOString()
        : null,
      githubCreatedAt: (repo['githubCreatedAt'] as Date).toISOString(),
      syncedAt: (repo['syncedAt'] as Date).toISOString(),
      updatedAt: (repo['updatedAt'] as Date).toISOString(),
    };
  }

  /**
   * Get paginated list of repos with cursor-based pagination.
   */
  async getRepositories(
    query: RepoQueryDto,
  ): Promise<PaginatedResponseDto<RepositoryResponseDto>> {
    try {
      const {
      cursor,
      perPage = 20,
      sort = 'stars_desc',
      language,
      topic,
      minStars,
      archived,
    } = query;

    // Check cache
    const cacheKey = CACHE_KEYS.repoList(
      cursor ?? null,
      perPage,
      sort,
      language ?? null,
    );
    const cached =
      await this.cache.get<PaginatedResponseDto<RepositoryResponseDto>>(
        cacheKey,
      );
    if (cached) return cached;

    // Build where clause
    const where: Prisma.RepositoryWhereInput = {
      isActive: true,
    };

    if (language) where.primaryLanguage = language;
    if (topic) where.topics = { has: topic };
    if (minStars !== undefined) where.starsCount = { gte: minStars };
    if (archived !== undefined) where.isArchived = archived;

    // Build orderBy from sort string
    const orderBy = this.buildOrderBy(sort);

    // Cursor-based pagination
    const findArgs: Prisma.RepositoryFindManyArgs = {
      where,
      orderBy,
      take: perPage + 1, // Take one extra to determine hasMore
      select: {
        id: true,
        name: true,
        fullName: true,
        description: true,
        htmlUrl: true,
        starsCount: true,
        forksCount: true,
        openIssuesCount: true,
        isArchived: true,
        activityScore: true,
        complexityScore: true,
        learningDifficulty: true,
        primaryLanguage: true,
        topics: true,
        licenseName: true,
        defaultBranch: true,
        lastPushedAt: true,
        githubCreatedAt: true,
        syncedAt: true,
        updatedAt: true,
      },
    };

    if (cursor) {
      const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
      findArgs.cursor = { id: BigInt(decodedCursor) };
      findArgs.skip = 1; // Skip the cursor item itself
    }

    const repos = await this.prisma.repository.findMany(findArgs);

    const hasMore = repos.length > perPage;
    const data = hasMore ? repos.slice(0, perPage) : repos;
    const nextCursor =
      hasMore && data.length > 0
        ? Buffer.from(String(data[data.length - 1].id)).toString('base64')
        : null;

    // Total count (cached separately)
    const total = await this.prisma.repository.count({ where });

    const result: PaginatedResponseDto<RepositoryResponseDto> = {
      data: data.map((r) =>
        this.toDto(r as unknown as Record<string, unknown>),
      ),
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    };

    await this.cache.set(cacheKey, result, CACHE_TTLS.REPO_LIST);
    return result;
    } catch (error) {
      this.logger.error(`Failed to fetch repositories: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  /**
   * Get a single repository by ID.
   */
  async getRepository(id: string): Promise<RepositoryResponseDto | null> {
    const repoId = BigInt(id);
    const cacheKey = CACHE_KEYS.repo(repoId);

    const cached = await this.cache.get<RepositoryResponseDto>(cacheKey);
    if (cached) return cached;

    const repo = await this.prisma.repository.findUnique({
      where: { id: repoId, isActive: true },
      select: {
        id: true,
        name: true,
        fullName: true,
        description: true,
        htmlUrl: true,
        starsCount: true,
        forksCount: true,
        openIssuesCount: true,
        isArchived: true,
        activityScore: true,
        complexityScore: true,
        learningDifficulty: true,
        primaryLanguage: true,
        topics: true,
        licenseName: true,
        defaultBranch: true,
        lastPushedAt: true,
        githubCreatedAt: true,
        syncedAt: true,
        updatedAt: true,
      },
    });

    if (!repo) return null;

    const dto = this.toDto(repo as unknown as Record<string, unknown>);
    await this.cache.set(cacheKey, dto, CACHE_TTLS.REPO);
    return dto;
  }

  /**
   * Search repos by name, description, or topics.
   */
  async searchRepositories(
    q: string,
    limit: number = 20,
  ): Promise<RepositoryResponseDto[]> {
    const queryHash = crypto.createHash('md5').update(q).digest('hex');
    const cacheKey = CACHE_KEYS.repoSearch(queryHash);

    const cached = await this.cache.get<RepositoryResponseDto[]>(cacheKey);
    if (cached) return cached;

    const searchTerm = `%${q}%`;

    const repos = await this.prisma.repository.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { topics: { has: q.toLowerCase() } },
        ],
      },
      take: limit,
      orderBy: { starsCount: 'desc' },
      select: {
        id: true,
        name: true,
        fullName: true,
        description: true,
        htmlUrl: true,
        starsCount: true,
        forksCount: true,
        openIssuesCount: true,
        isArchived: true,
        activityScore: true,
        complexityScore: true,
        learningDifficulty: true,
        primaryLanguage: true,
        topics: true,
        licenseName: true,
        defaultBranch: true,
        lastPushedAt: true,
        githubCreatedAt: true,
        syncedAt: true,
        updatedAt: true,
      },
    });

    const dtos = repos.map((r) =>
      this.toDto(r as unknown as Record<string, unknown>),
    );
    await this.cache.set(cacheKey, dtos, CACHE_TTLS.REPO_SEARCH);
    return dtos;
  }

  /**
   * Get contributors for a repository.
   */
  async getContributors(id: string): Promise<ContributorResponseDto[]> {
    const repoId = BigInt(id);
    const cacheKey = CACHE_KEYS.contributors(repoId);

    const cached = await this.cache.get<ContributorResponseDto[]>(cacheKey);
    if (cached) return cached;

    const repoContributors = await this.prisma.repositoryContributor.findMany({
      where: { repositoryId: repoId },
      include: {
        contributor: {
          select: {
            id: true,
            login: true,
            avatarUrl: true,
            htmlUrl: true,
          },
        },
      },
      orderBy: { contributions: 'desc' },
    });

    const dtos: ContributorResponseDto[] = repoContributors.map((rc) => ({
      id: String(rc.contributor.id),
      login: rc.contributor.login,
      avatarUrl: rc.contributor.avatarUrl,
      htmlUrl: rc.contributor.htmlUrl,
      contributions: rc.contributions,
    }));

    await this.cache.set(cacheKey, dtos, CACHE_TTLS.CONTRIBUTORS);
    return dtos;
  }

  /**
   * Get languages for a repository.
   */
  async getLanguages(id: string): Promise<LanguageResponseDto[]> {
    const repoId = BigInt(id);
    const cacheKey = CACHE_KEYS.languages(repoId);

    const cached = await this.cache.get<LanguageResponseDto[]>(cacheKey);
    if (cached) return cached;

    const languages = await this.prisma.repositoryLanguage.findMany({
      where: { repositoryId: repoId },
      orderBy: { bytes: 'desc' },
      select: {
        language: true,
        bytes: true,
        percentage: true,
      },
    });

    const dtos: LanguageResponseDto[] = languages.map((l) => ({
      language: l.language,
      bytes: String(l.bytes),
      percentage: Number(l.percentage),
    }));

    await this.cache.set(cacheKey, dtos, CACHE_TTLS.LANGUAGES);
    return dtos;
  }

  /**
   * Get commit activity (52 weeks) for a repo.
   */
  async getActivity(id: string): Promise<CommitActivityResponseDto[]> {
    const repoId = BigInt(id);
    const cacheKey = CACHE_KEYS.activity(repoId);

    const cached = await this.cache.get<CommitActivityResponseDto[]>(cacheKey);
    if (cached) return cached;

    const activity = await this.prisma.commitActivity.findMany({
      where: { repositoryId: repoId },
      orderBy: { weekStart: 'asc' },
      select: {
        weekStart: true,
        commitCount: true,
      },
    });

    const dtos: CommitActivityResponseDto[] = activity.map((a) => ({
      weekStart: a.weekStart.toISOString(),
      commitCount: a.commitCount,
    }));

    await this.cache.set(cacheKey, dtos, CACHE_TTLS.ACTIVITY);
    return dtos;
  }

  /**
   * Get aggregate statistics.
   */
  async getStats(): Promise<StatsResponseDto> {
    const cacheKey = CACHE_KEYS.stats();

    const cached = await this.cache.get<StatsResponseDto>(cacheKey);
    if (cached) return cached;

    const [totalRepos, aggregates, contributorCount, languageGroups, topRepos] =
      await Promise.all([
        this.prisma.repository.count({ where: { isActive: true } }),
        this.prisma.repository.aggregate({
          where: { isActive: true },
          _sum: { starsCount: true, forksCount: true },
        }),
        this.prisma.contributor.count(),
        this.prisma.repositoryLanguage.groupBy({
          by: ['language'],
          _count: { language: true },
          orderBy: { _count: { language: 'desc' } },
          take: 20,
        }),
        this.prisma.repository.findMany({
          where: { isActive: true },
          orderBy: { starsCount: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            fullName: true,
            description: true,
            htmlUrl: true,
            starsCount: true,
            forksCount: true,
            openIssuesCount: true,
            isArchived: true,
            activityScore: true,
            complexityScore: true,
            learningDifficulty: true,
            primaryLanguage: true,
            topics: true,
            licenseName: true,
            defaultBranch: true,
            lastPushedAt: true,
            githubCreatedAt: true,
            syncedAt: true,
            updatedAt: true,
          },
        }),
      ]);

    const stats: StatsResponseDto = {
      totalRepositories: totalRepos,
      totalStars: aggregates._sum.starsCount ?? 0,
      totalForks: aggregates._sum.forksCount ?? 0,
      totalContributors: contributorCount,
      languages: languageGroups.map((g) => ({
        language: g.language,
        count: g._count.language,
      })),
      topRepositories: topRepos.map((r) =>
        this.toDto(r as unknown as Record<string, unknown>),
      ),
    };

    await this.cache.set(cacheKey, stats, CACHE_TTLS.STATS);
    return stats;
  }

  /**
   * Build Prisma orderBy from sort string.
   */
  private buildOrderBy(
    sort: string,
  ): Prisma.RepositoryOrderByWithRelationInput {
    switch (sort) {
      case 'stars_desc':
        return { starsCount: 'desc' };
      case 'stars_asc':
        return { starsCount: 'asc' };
      case 'updated_desc':
        return { lastPushedAt: 'desc' };
      case 'name_asc':
        return { name: 'asc' };
      case 'forks_desc':
        return { forksCount: 'desc' };
      default:
        return { starsCount: 'desc' };
    }
  }

  /**
   * Queue custom repository URLs for analysis.
   */
  async analyzeRepositories(
    urls: string[],
  ): Promise<{ message: string; queued: number }> {
    let queued = 0;
    for (const url of urls) {
      try {
        const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
        if (match && match[1]) {
          let fullName = match[1];
          if (fullName.endsWith('.git')) fullName = fullName.slice(0, -4);

          await this.sync.enqueueRepoSync(fullName, 'manual-analyze', 1);
          queued++;
        }
      } catch (err) {
        this.logger.error(`Failed to enqueue manual analysis for URL: ${url}`);
      }
    }
    return { message: `Queued ${queued} repositories for analysis.`, queued };
  }

  /**
   * Get structured analysis report.
   */
  async getAnalysisReport(id: string): Promise<AnalysisReportResponseDto> {
    const repoId = BigInt(id);
    const repo = await this.prisma.repository.findUnique({
      where: { id: repoId, isActive: true },
      include: {
        contributors: true,
        languages: true,
        commitActivity: { orderBy: { weekStart: 'desc' }, take: 12 },
      },
    });

    if (!repo) {
      throw new NotFoundException(`Repository with ID ${id} not found`);
    }

    const analysis = this.analyzer.compute(repo as any);

    return {
      repository: repo.fullName,
      generatedAt: new Date().toISOString(),
      scores: {
        activityScore: repo.activityScore,
        complexityScore: repo.complexityScore,
        learningDifficulty: repo.learningDifficulty,
      },
      breakdown: analysis.breakdown,
      formulas: {
        activityScore:
          'min(commits/52,1)×40 + min(contributors/20,1)×30 + issues×20 + stars×10',
        complexityScore:
          'min(languages/5,1)×40 + min(sizeKB/10000,1)×30 + deps×20 + topics×10',
        learningDifficulty:
          'combined=(activity×0.4)+(complexity×0.6); <35=Beginner, <65=Intermediate, ≥65=Advanced',
      },
    };
  }
}
