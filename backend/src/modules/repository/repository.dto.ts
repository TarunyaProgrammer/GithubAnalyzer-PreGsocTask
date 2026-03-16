import { IsOptional, IsString, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class RepoQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  perPage?: number = 20;

  @IsOptional()
  @IsString()
  sort?: string = 'stars_desc';

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStars?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  archived?: boolean = false;
}

export class SearchQueryDto {
  @IsString()
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// Response DTOs — never expose raw Prisma models

export interface RepositoryResponseDto {
  id: string; // BigInt serialized as string for JSON
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  starsCount: number;
  forksCount: number;
  openIssuesCount: number;
  isArchived: boolean;
  activityScore: number | null;
  complexityScore: number | null;
  learningDifficulty: string | null;
  primaryLanguage: string | null;
  topics: string[];
  licenseName: string | null;
  defaultBranch: string;
  lastPushedAt: string | null;
  githubCreatedAt: string;
  syncedAt: string;
  updatedAt: string;
}

export interface ContributorResponseDto {
  id: string;
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  contributions: number;
}

export interface LanguageResponseDto {
  language: string;
  bytes: string;
  percentage: number;
}

export interface CommitActivityResponseDto {
  weekStart: string;
  commitCount: number;
}

export interface PaginatedResponseDto<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    total: number;
  };
}

export interface StatsResponseDto {
  totalRepositories: number;
  totalStars: number;
  totalForks: number;
  totalContributors: number;
  languages: Array<{ language: string; count: number }>;
  topRepositories: RepositoryResponseDto[];
}

import { IsArray, IsUrl } from 'class-validator';

export class AnalyzeUrlsDto {
  @IsArray()
  @IsUrl({}, { each: true })
  urls!: string[];
}

export interface AnalysisReportResponseDto {
  repository: string;
  generatedAt: string;
  scores: {
    activityScore: number | null;
    complexityScore: number | null;
    learningDifficulty: string | null;
  };
  breakdown: {
    recentCommits12w: number;
    contributorCount: number;
    languageCount: number;
    repoSizeKB: number;
    openIssues: number;
    topicCount: number;
    isArchived: boolean;
    hasDependencyFile: boolean;
  };
  formulas: {
    activityScore: string;
    complexityScore: string;
    learningDifficulty: string;
  };
}
