import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { graphql } from '@octokit/graphql';
import { Octokit } from '@octokit/rest';
import { CacheService } from '../cache';
import {
  GitHubGraphQLRepo,
  GitHubContributor,
  GitHubLanguages,
  GitHubCommitActivity,
  RateLimitInfo,
  GitHubRepoListItem,
} from './github.types';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private readonly graphqlClient: typeof graphql;
  private readonly restClient: Octokit;
  private readonly org: string;

  private circuitBreakerOpen = false;
  private circuitBreakerResetTime = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    const token = this.configService.get<string>('GITHUB_TOKEN', '');
    this.org = this.configService.get<string>('GITHUB_ORG', 'c2siorg');

    this.graphqlClient = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });

    this.restClient = new Octokit({ auth: token });
  }

  /**
   * Check if the circuit breaker is open (rate limit exhausted).
   */
  private checkCircuitBreaker(): void {
    if (this.circuitBreakerOpen) {
      if (Date.now() / 1000 > this.circuitBreakerResetTime) {
        this.circuitBreakerOpen = false;
        this.logger.log('Circuit breaker closed — rate limit should be reset');
      } else {
        throw new HttpException(
          'GitHub API rate limit exhausted. Retry later.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }
  }

  /**
   * Monitor rate limit from response headers and manage circuit breaker.
   */
  private monitorRateLimit(rateLimitInfo: RateLimitInfo): void {
    const { remaining, reset } = rateLimitInfo;

    if (remaining < 100) {
      this.circuitBreakerOpen = true;
      this.circuitBreakerResetTime = reset;
      this.logger.error(
        `Circuit breaker OPEN — remaining: ${remaining}, resets at: ${new Date(reset * 1000).toISOString()}`,
      );
    } else if (remaining < 500) {
      this.logger.warn(`GitHub rate limit low: ${remaining} remaining`);
    } else if (remaining < 1000) {
      this.logger.log(`GitHub rate limit: ${remaining} remaining`);
    }
  }

  /**
   * List all repositories in the organization using REST API with pagination.
   */
  async listOrgRepos(): Promise<GitHubRepoListItem[]> {
    this.checkCircuitBreaker();

    const repos: GitHubRepoListItem[] = [];
    let page = 1;

    try {
      while (true) {
        const response = await this.restClient.repos.listForOrg({
          org: this.org,
          type: 'public',
          per_page: 100,
          page,
        });

        // Monitor rate limit
        const headers = response.headers;
        this.monitorRateLimit({
          remaining:
            parseInt(headers['x-ratelimit-remaining'] as string, 10) || 5000,
          limit: parseInt(headers['x-ratelimit-limit'] as string, 10) || 5000,
          reset: parseInt(headers['x-ratelimit-reset'] as string, 10) || 0,
          used: parseInt(headers['x-ratelimit-used'] as string, 10) || 0,
        });

        repos.push(
          ...response.data.map((r) => ({
            id: r.id,
            name: r.name,
            full_name: r.full_name,
          })),
        );

        if (response.data.length < 100) break;
        page++;
      }
    } catch (err) {
      this.logger.error(`Failed to list org repos: ${(err as Error).message}`);
      throw err;
    }

    this.logger.log(`Found ${repos.length} repositories in org "${this.org}"`);
    return repos;
  }

  /**
   * Build and execute a GraphQL batch query for multiple repositories.
   * Fetches up to 100 repos in a single API request using field aliases.
   */
  async batchFetchRepos(
    repoNames: string[],
  ): Promise<Map<string, GitHubGraphQLRepo>> {
    this.checkCircuitBreaker();

    const results = new Map<string, GitHubGraphQLRepo>();

    // Process in chunks of 100
    for (let i = 0; i < repoNames.length; i += 100) {
      const chunk = repoNames.slice(i, i + 100);
      const queryParts = chunk.map((name, idx) => {
        return `repo${idx}: repository(owner: "${this.org}", name: "${name}") {
          id
          databaseId
          name
          description
          url
          stargazerCount
          forkCount
          openIssues: issues(states: OPEN) { totalCount }
          primaryLanguage { name }
          pushedAt
          createdAt
          isArchived
          repositoryTopics(first: 20) {
            nodes { topic { name } }
          }
          licenseInfo { spdxId }
          defaultBranchRef { name }
        }`;
      });

      const query = `query BatchRepos { ${queryParts.join('\n')} }`;

      try {
        const response =
          await this.graphqlClient<Record<string, GitHubGraphQLRepo>>(query);

        // Extract rate limit from response headers (captured via graphql client)
        chunk.forEach((name, idx) => {
          const key = `repo${idx}`;
          if (response[key]) {
            results.set(name, response[key]);
          }
        });

        this.logger.log(
          `Batch fetched ${chunk.length} repos (chunk ${Math.floor(i / 100) + 1}/${Math.ceil(repoNames.length / 100)})`,
        );
      } catch (err) {
        this.logger.error(
          `GraphQL batch fetch failed: ${(err as Error).message}`,
        );
        // On rate limit errors, open circuit breaker
        if ((err as Record<string, unknown>)['status'] === 403) {
          this.circuitBreakerOpen = true;
          this.circuitBreakerResetTime = Math.floor(Date.now() / 1000) + 3600;
        }
        throw err;
      }
    }

    return results;
  }

  /**
   * Fetch a single repository using GraphQL.
   */
  async fetchSingleRepo(
    repoName: string,
    owner?: string,
  ): Promise<GitHubGraphQLRepo | null> {
    this.checkCircuitBreaker();
    const repoOwner = owner || this.org;

    try {
      const query = `query {
        repository(owner: "${repoOwner}", name: "${repoName}") {
          id
          databaseId
          name
          description
          url
          stargazerCount
          forkCount
          openIssues: issues(states: OPEN) { totalCount }
          primaryLanguage { name }
          pushedAt
          createdAt
          isArchived
          repositoryTopics(first: 20) {
            nodes { topic { name } }
          }
          licenseInfo { spdxId }
          defaultBranchRef { name }
        }
      }`;

      const response = await this.graphqlClient<{
        repository: GitHubGraphQLRepo;
      }>(query);
      return response.repository;
    } catch (err) {
      this.logger.error(
        `Failed to fetch repo "${repoName}": ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Fetch contributors for a repository using REST API with ETag caching.
   */
  async fetchContributors(
    repoName: string,
    owner?: string,
  ): Promise<GitHubContributor[]> {
    this.checkCircuitBreaker();
    const repoOwner = owner || this.org;

    const etagKey = `etag:contributors:${repoOwner}/${repoName}`;
    const dataKey = `contributors:data:${repoOwner}/${repoName}`;

    try {
      // Check for stored ETag
      const storedEtag = await this.cacheService.get<string>(etagKey);
      const headers: Record<string, string> = {};
      if (storedEtag) {
        headers['If-None-Match'] = storedEtag;
      }

      const response = await this.restClient.repos.listContributors({
        owner: repoOwner,
        repo: repoName,
        per_page: 100,
        headers,
      });

      // Monitor rate limit
      this.monitorRateLimit({
        remaining:
          parseInt(response.headers['x-ratelimit-remaining'] as string, 10) ||
          5000,
        limit:
          parseInt(response.headers['x-ratelimit-limit'] as string, 10) || 5000,
        reset:
          parseInt(response.headers['x-ratelimit-reset'] as string, 10) || 0,
        used: parseInt(response.headers['x-ratelimit-used'] as string, 10) || 0,
      });

      // Store new ETag
      if (response.headers.etag) {
        await this.cacheService.set(etagKey, response.headers.etag, 86400);
      }

      const contributors: GitHubContributor[] = (response.data || []).map(
        (c) => ({
          id: c.id ?? 0,
          login: c.login ?? 'unknown',
          avatar_url: c.avatar_url ?? '',
          html_url: c.html_url ?? '',
          contributions: c.contributions,
        }),
      );

      // Cache the data
      await this.cacheService.set(dataKey, contributors, 86400);

      return contributors;
    } catch (err) {
      // On 304 Not Modified, return cached data
      if ((err as Record<string, unknown>)['status'] === 304) {
        const cached =
          await this.cacheService.get<GitHubContributor[]>(dataKey);
        return cached ?? [];
      }

      this.logger.error(
        `Failed to fetch contributors for "${repoName}": ${(err as Error).message}`,
      );
      // Return cached data on error
      const cached = await this.cacheService.get<GitHubContributor[]>(dataKey);
      return cached ?? [];
    }
  }

  /**
   * Fetch languages for a repository using REST API with ETag caching.
   */
  async fetchLanguages(
    repoName: string,
    owner?: string,
  ): Promise<GitHubLanguages> {
    this.checkCircuitBreaker();
    const repoOwner = owner || this.org;

    const etagKey = `etag:languages:${repoOwner}/${repoName}`;
    const dataKey = `languages:data:${repoOwner}/${repoName}`;

    try {
      const storedEtag = await this.cacheService.get<string>(etagKey);
      const headers: Record<string, string> = {};
      if (storedEtag) {
        headers['If-None-Match'] = storedEtag;
      }

      const response = await this.restClient.repos.listLanguages({
        owner: repoOwner,
        repo: repoName,
        headers,
      });

      this.monitorRateLimit({
        remaining:
          parseInt(response.headers['x-ratelimit-remaining'] as string, 10) ||
          5000,
        limit:
          parseInt(response.headers['x-ratelimit-limit'] as string, 10) || 5000,
        reset:
          parseInt(response.headers['x-ratelimit-reset'] as string, 10) || 0,
        used: parseInt(response.headers['x-ratelimit-used'] as string, 10) || 0,
      });

      if (response.headers.etag) {
        await this.cacheService.set(etagKey, response.headers.etag, 3600);
      }

      const languages = response.data as GitHubLanguages;
      await this.cacheService.set(dataKey, languages, 3600);

      return languages;
    } catch (err) {
      if ((err as Record<string, unknown>)['status'] === 304) {
        const cached = await this.cacheService.get<GitHubLanguages>(dataKey);
        return cached ?? {};
      }

      this.logger.error(
        `Failed to fetch languages for "${repoName}": ${(err as Error).message}`,
      );
      const cached = await this.cacheService.get<GitHubLanguages>(dataKey);
      return cached ?? {};
    }
  }

  /**
   * Fetch commit activity (52 weeks) for a repository.
   */
  async fetchCommitActivity(
    repoName: string,
    owner?: string,
  ): Promise<GitHubCommitActivity[]> {
    this.checkCircuitBreaker();
    const repoOwner = owner || this.org;

    try {
      const response = await this.restClient.repos.getCommitActivityStats({
        owner: repoOwner,
        repo: repoName,
      });

      this.monitorRateLimit({
        remaining:
          parseInt(response.headers['x-ratelimit-remaining'] as string, 10) ||
          5000,
        limit:
          parseInt(response.headers['x-ratelimit-limit'] as string, 10) || 5000,
        reset:
          parseInt(response.headers['x-ratelimit-reset'] as string, 10) || 0,
        used: parseInt(response.headers['x-ratelimit-used'] as string, 10) || 0,
      });

      // GitHub may return 202 (computing stats) — retry after a delay
      if (response.status === 202) {
        this.logger.log(
          `Commit activity computing for "${repoName}" — will retry later`,
        );
        return [];
      }

      return (response.data as GitHubCommitActivity[]) || [];
    } catch (err) {
      this.logger.error(
        `Failed to fetch commit activity for "${repoName}": ${(err as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Get current rate limit status.
   */
  async getRateLimitStatus(): Promise<RateLimitInfo> {
    try {
      const response = await this.restClient.rateLimit.get();
      return {
        remaining: response.data.resources.core.remaining,
        limit: response.data.resources.core.limit,
        reset: response.data.resources.core.reset,
        used: response.data.resources.core.used,
      };
    } catch (err) {
      this.logger.error(`Failed to get rate limit: ${(err as Error).message}`);
      return { remaining: 0, limit: 5000, reset: 0, used: 0 };
    }
  }

  /**
   * Check if circuit breaker is currently open.
   */
  isCircuitBreakerOpen(): boolean {
    return this.circuitBreakerOpen;
  }
}
