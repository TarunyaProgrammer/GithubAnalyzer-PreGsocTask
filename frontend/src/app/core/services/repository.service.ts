import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Repository {
  id: string;
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

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    total: number;
  };
}

export interface StatsResponse {
  totalRepositories: number;
  totalStars: number;
  totalForks: number;
  totalContributors: number;
  languages: Array<{ language: string; count: number }>;
  topRepositories: Repository[];
}

export interface Contributor {
  id: string;
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  contributions: number;
}

export interface Language {
  language: string;
  bytes: string;
  percentage: number;
}

export interface CommitActivity {
  weekStart: string;
  commitCount: number;
}

export interface AnalysisReport {
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

@Injectable({
  providedIn: 'root'
})
export class RepositoryService {
  private readonly apiUrl = 'http://localhost:3000/api/repos';

  constructor(private http: HttpClient) {}

  getRepositories(params: {
    cursor?: string;
    perPage?: number;
    sort?: string;
    language?: string;
    topic?: string;
    minStars?: number;
    archived?: boolean;
  } = {}): Observable<PaginatedResponse<Repository>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });

    return this.http.get<PaginatedResponse<Repository>>(this.apiUrl, { params: httpParams });
  }

  getStats(): Observable<StatsResponse> {
    return this.http.get<StatsResponse>(`${this.apiUrl}/stats`);
  }

  searchRepositories(query: string, limit: number = 20): Observable<Repository[]> {
    const params = new HttpParams().set('q', query).set('limit', limit.toString());
    return this.http.get<Repository[]>(`${this.apiUrl}/search`, { params });
  }

  getRepository(id: string): Observable<Repository> {
    return this.http.get<Repository>(`${this.apiUrl}/${id}`);
  }

  getContributors(id: string): Observable<Contributor[]> {
    return this.http.get<Contributor[]>(`${this.apiUrl}/${id}/contributors`);
  }

  getLanguages(id: string): Observable<Language[]> {
    return this.http.get<Language[]>(`${this.apiUrl}/${id}/languages`);
  }

  getActivity(id: string): Observable<CommitActivity[]> {
    return this.http.get<CommitActivity[]>(`${this.apiUrl}/${id}/activity`);
  }

  analyzeRepositories(urls: string[]): Observable<{ message: string; queued: number }> {
    return this.http.post<{ message: string; queued: number }>(`${this.apiUrl}/analyze`, { urls });
  }

  getAnalysisReport(id: string): Observable<AnalysisReport> {
    return this.http.get<AnalysisReport>(`${this.apiUrl}/${id}/report`);
  }
}
