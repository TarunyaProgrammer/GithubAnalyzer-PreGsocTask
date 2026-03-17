import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  GitHubGraphQLRepo,
  GitHubContributor,
  GitHubLanguages,
  GitHubCommitActivity,
} from '../github';

/**
 * Transforms raw GitHub API responses into Prisma-compatible upsert payloads.
 * No `any` types — everything is explicitly typed.
 */
@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  /**
   * Normalize a GraphQL repo response into a Prisma Repository upsert payload.
   */
  processRepository(raw: GitHubGraphQLRepo): Prisma.RepositoryUpsertArgs {
    const topics = raw.repositoryTopics.nodes.map((n) => n.topic.name);

    const data: Prisma.RepositoryCreateInput = {
      id: BigInt(raw.databaseId),
      name: raw.name,
      fullName: `${raw.name}`, // Will be overwritten with org prefix
      description: raw.description,
      htmlUrl: raw.url,
      starsCount: raw.stargazerCount,
      forksCount: raw.forkCount,
      openIssuesCount: raw.openIssues.totalCount,
      isArchived: raw.isArchived,
      isActive: true,
      primaryLanguage: raw.primaryLanguage?.name ?? null,
      topics,
      licenseName: raw.licenseInfo?.spdxId ?? null,
      defaultBranch: raw.defaultBranchRef?.name ?? 'main',
      lastPushedAt: raw.pushedAt ? new Date(raw.pushedAt) : null,
      githubCreatedAt: new Date(raw.createdAt),
      syncedAt: new Date(),
    };

    return {
      where: { id: BigInt(raw.databaseId) },
      create: data,
      update: {
        name: data.name,
        description: data.description,
        htmlUrl: data.htmlUrl,
        starsCount: data.starsCount,
        forksCount: data.forksCount,
        openIssuesCount: data.openIssuesCount,
        isArchived: data.isArchived,
        primaryLanguage: data.primaryLanguage,
        topics: data.topics,
        licenseName: data.licenseName,
        defaultBranch: data.defaultBranch,
        lastPushedAt: data.lastPushedAt,
        syncedAt: data.syncedAt,
      },
    };
  }

  /**
   * Process contributors into Prisma upsert payloads.
   */
  processContributors(
    repositoryId: bigint,
    raw: GitHubContributor[],
  ): {
    contributorUpserts: Prisma.ContributorUpsertArgs[];
    joinUpserts: Array<{
      repositoryId: bigint;
      contributorId: bigint;
      contributions: number;
    }>;
  } {
    const contributorUpserts: Prisma.ContributorUpsertArgs[] = raw.map((c) => ({
      where: { id: BigInt(c.id) },
      create: {
        id: BigInt(c.id),
        login: c.login,
        avatarUrl: c.avatar_url,
        htmlUrl: c.html_url,
      },
      update: {
        login: c.login,
        avatarUrl: c.avatar_url,
        htmlUrl: c.html_url,
      },
    }));

    const joinUpserts = raw.map((c) => ({
      repositoryId,
      contributorId: BigInt(c.id),
      contributions: c.contributions,
    }));

    return { contributorUpserts, joinUpserts };
  }

  /**
   * Process languages into Prisma RepositoryLanguage payloads.
   * Computes percentage from byte counts.
   */
  processLanguages(
    repositoryId: bigint,
    raw: GitHubLanguages,
  ): Array<{
    repositoryId: bigint;
    language: string;
    bytes: bigint;
    percentage: number;
  }> {
    const totalBytes = Object.values(raw).reduce((sum, b) => sum + b, 0);
    if (totalBytes === 0) return [];

    return Object.entries(raw).map(([language, bytes]) => ({
      repositoryId,
      language,
      bytes: BigInt(bytes),
      percentage: parseFloat(((bytes / totalBytes) * 100).toFixed(2)),
    }));
  }

  /**
   * Process commit activity into Prisma CommitActivity payloads.
   */
  processCommitActivity(
    repositoryId: bigint,
    raw: GitHubCommitActivity[],
  ): Array<{
    repositoryId: bigint;
    weekStart: Date;
    commitCount: number;
  }> {
    return raw.map((week) => ({
      repositoryId,
      weekStart: new Date(week.week * 1000),
      commitCount: week.total,
    }));
  }
}
