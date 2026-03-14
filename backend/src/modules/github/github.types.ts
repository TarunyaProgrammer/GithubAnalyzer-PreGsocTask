/**
 * Raw GitHub API response types — typed to avoid `any`.
 */

export interface GitHubGraphQLRepo {
  id: string;
  databaseId: number;
  name: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  forkCount: number;
  openIssues: { totalCount: number };
  primaryLanguage: { name: string } | null;
  pushedAt: string | null;
  createdAt: string;
  isArchived: boolean;
  repositoryTopics: {
    nodes: Array<{ topic: { name: string } }>;
  };
  licenseInfo: { spdxId: string } | null;
  defaultBranchRef: { name: string } | null;
}

export interface GitHubContributor {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

export interface GitHubLanguages {
  [language: string]: number; // language -> bytes
}

export interface GitHubCommitActivity {
  days: number[];
  total: number;
  week: number; // Unix timestamp
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  reset: number; // Unix timestamp
  used: number;
}

export interface GitHubRepoListItem {
  id: number;
  name: string;
  full_name: string;
}
