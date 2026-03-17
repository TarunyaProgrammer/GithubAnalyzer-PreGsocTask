import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';

export interface AnalysisResult {
  activityScore: number;
  complexityScore: number;
  learningDifficulty: 'Beginner' | 'Intermediate' | 'Advanced';
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
}

// Languages that typically have a dependency/package file
const DEPENDENCY_LANGUAGES = new Set([
  'JavaScript',
  'TypeScript',
  'Python',
  'Rust',
  'Go',
  'Java',
  'Kotlin',
  'Swift',
  'PHP',
  'Ruby',
  'C#',
  'Dart',
]);

@Injectable()
export class AnalyzerService {
  private readonly logger = new Logger(AnalyzerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute and persist analyzer scores for a single repository.
   * Uses data already in DB — no extra GitHub API calls required.
   */
  async analyzeAndSave(repoId: bigint): Promise<AnalysisResult | null> {
    try {
      const repo = await this.prisma.repository.findUnique({
        where: { id: repoId },
        include: {
          contributors: true,
          languages: true,
          commitActivity: {
            orderBy: { weekStart: 'desc' },
            take: 12,
          },
        },
      });

      if (!repo) {
        this.logger.warn(`Repo ID ${repoId} not found — skipping analysis`);
        return null;
      }

      const result = this.compute(repo);

      await this.prisma.repository.update({
        where: { id: repoId },
        data: {
          activityScore: result.activityScore,
          complexityScore: result.complexityScore,
          learningDifficulty: result.learningDifficulty,
        },
      });

      this.logger.log(
        `Analyzed "${repo.fullName}": activity=${result.activityScore.toFixed(1)} ` +
          `complexity=${result.complexityScore.toFixed(1)} ` +
          `difficulty=${result.learningDifficulty}`,
      );

      return result;
    } catch (err) {
      this.logger.error(
        `Analysis failed for repo ID ${repoId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Compute scores without persisting — useful for on-demand analysis.
   */
  compute(repo: {
    starsCount: number;
    openIssuesCount: number;
    isArchived: boolean;
    topics: string[];
    metadata: unknown;
    contributors: Array<unknown>;
    languages: Array<{ language: string; bytes: bigint }>;
    commitActivity: Array<{ commitCount: number }>;
  }): AnalysisResult {
    const contributorCount = repo.contributors.length;
    const languageCount = repo.languages.length;
    const topicCount = repo.topics.length;

    // Extract repo size from metadata JSON (stored as GitHub diskUsage in KB)
    const meta = repo.metadata as Record<string, unknown> | null;
    const repoSizeKB = typeof meta?.diskUsage === 'number' ? meta.diskUsage : 0;

    // Sum last 12 weeks of commits (or all available if < 12 weeks)
    const recentCommits12w = repo.commitActivity.reduce(
      (sum, w) => sum + w.commitCount,
      0,
    );

    // Check if primary language implies a dependency file exists
    const primaryLangs = repo.languages.map((l) => l.language);
    const hasDependencyFile = primaryLangs.some((l) =>
      DEPENDENCY_LANGUAGES.has(l),
    );

    // ── Activity Score ──────────────────────────────────────────
    // commit frequency:    40 pts (normalized to ~1 commit/week over 12 weeks)
    // contributor breadth: 30 pts (normalized to 20 contributors = 100%)
    // issue activity:      20 pts (any open issues = sign of active community)
    // community interest:  10 pts (>10 stars = notable project)
    let activityScore =
      Math.min(recentCommits12w / 52, 1) * 40 +
      Math.min(contributorCount / 20, 1) * 30 +
      (repo.openIssuesCount > 0 ? 20 : 0) +
      (repo.starsCount > 10 ? 10 : 0);

    // Archived repos are no longer actively maintained
    if (repo.isArchived) {
      activityScore = Math.min(activityScore, 20);
    }

    activityScore = clamp(activityScore, 0, 100);

    // ── Complexity Score ────────────────────────────────────────
    // language diversity:  40 pts (5+ languages = max)
    // repo size:           30 pts (10MB+ = max complexity proxy)
    // dependency file:     20 pts (package manifest = real project with deps)
    // topic richness:      10 pts (>5 topics = broad/complex scope)
    const complexityScore = clamp(
      Math.min(languageCount / 5, 1) * 40 +
        Math.min(repoSizeKB / 10_000, 1) * 30 +
        (hasDependencyFile ? 20 : 0) +
        (topicCount > 5 ? 10 : 0),
      0,
      100,
    );

    // ── Learning Difficulty ─────────────────────────────────────
    // Activity weighted at 40%, complexity at 60% (complexity drives learning curve more)
    const combined = activityScore * 0.4 + complexityScore * 0.6;
    const learningDifficulty: 'Beginner' | 'Intermediate' | 'Advanced' =
      combined < 35 ? 'Beginner' : combined < 65 ? 'Intermediate' : 'Advanced';

    return {
      activityScore: round(activityScore),
      complexityScore: round(complexityScore),
      learningDifficulty,
      breakdown: {
        recentCommits12w,
        contributorCount,
        languageCount,
        repoSizeKB,
        openIssues: repo.openIssuesCount,
        topicCount,
        isArchived: repo.isArchived,
        hasDependencyFile,
      },
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
