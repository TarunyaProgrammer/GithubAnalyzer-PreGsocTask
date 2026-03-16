# GitHub Repository Intelligence Analyzer

The **Intelligence Analyzer** assesses GitHub repositories based on their open-source community health, structure, and scale. It uses existing synchronized metadata to avoid rate-limiting issues, operating entirely independently of additional GitHub API requests.

## Architecture

The Analyzer operates in two main modes:
1. **Background Mode**: Tightly integrated into the `SyncProcessor`. Any repository synchronized naturally gets analyzed entirely offline in memory using stored relationships.
2. **On-Demand Mode**: Triggered by hitting the `/api/repos/analyze` REST endpoint with an external repository URL.

## Scoring Algorithms

### Activity Score (100-point scale)
Measures the vitality, health, and recent maintenance of a repository.

**Formula Overview:**
1. **Commit Frequency (40%)**: Sums commit activity over the past 12 weeks. Maximum value is achieved with 52+ commits in the period.
2. **Contributor Breadth (30%)**: Count of unique contributors. Maximum value is achieved with 20+ contributors. 
3. **Issue Activity (20%)**: Binary check if the repository has open issues (indicates active issue tracking/requests).
4. **Community Engagement (10%)**: Binary check if the repository has more than 10 stars.

*Archived Repositories:* If a repository is marked as archived, the score is brutally capped at a maximum of `20` regardless of past historical metrics.

### Complexity Score (100-point scale)
Measures the structural difficulty, language diversity, and codebase size.

**Formula Overview:**
1. **Language Diversity (40%)**: The number of detected programming languages. Peaks at 5+ languages.
2. **File Count Proxy / Size (30%)**: A direct interpretation of `diskUsage` (in KB) substituting file checks to preserve API rate limits. Peaks at a 10MB size.
3. **Dependency Presence (20%)**: Evaluates if the primary language is known to require dense dependency manifests (JavaScript, TypeScript, Python, Rust, Go).
4. **Topic Richness (10%)**: Whether the codebase relies and documents more than 5 overarching system topics (e.g. `react`, `database`, `cloud`, `api`).

### Learning Difficulty Classification
A high-level categorical deduction of the repository intended for students and OSS newcomers.

**Formula Overview:**
- Combined Metric = `(Activity Score * 0.4) + (Complexity Score * 0.6)`
- `Beginner`: Combined Metric < 35
- `Intermediate`: Combined Metric < 65
- `Advanced`: Combined Metric >= 65

## Limits & Proxies

To operate at a large scale without blowing the GitHub REST limits, the analyzer proxies two typical features:
- **Dependency Files**: We do not fetch raw file contents from `package.json` or `go.mod`. We infer strong dependency complexities from the primary configured language string.
- **File Counts**: We do not recursively fetch the Git Tree map. We rely strictly on `diskUsage` natively returned from the GraphQL API as an arbitrary size index substitute.

## Sample Analysis Reports

Below are some example responses extracted from the `/api/repos/:id/report` REST route:

### Sample 1: OpenIoE (Beginner)
```json
{
  "repository": "c2siorg/OpenIoE",
  "generatedAt": "2026-03-15T00:00:00Z",
  "scores": {
    "activityScore": 30.0,
    "complexityScore": 28.0,
    "learningDifficulty": "Beginner"
  },
  "breakdown": {
    "recentCommits12w": 0,
    "contributorCount": 3,
    "languageCount": 1,
    "repoSizeKB": 1520,
    "openIssues": 5,
    "topicCount": 2,
    "isArchived": false,
    "hasDependencyFile": false
  },
  "formulas": {
    "activityScore": "min(commits/52,1)×40 + min(contributors/20,1)×30 + issues×20 + stars×10",
    "complexityScore": "min(languages/5,1)×40 + min(sizeKB/10000,1)×30 + deps×20 + topics×10",
    "learningDifficulty": "combined=(activity×0.4)+(complexity×0.6); <35=Beginner, <65=Intermediate, ≥65=Advanced"
  }
}
```

### Sample 2: Webiu (Intermediate)
```json
{
  "repository": "c2siorg/Webiu",
  "generatedAt": "2026-03-15T00:00:00Z",
  "scores": {
    "activityScore": 65.0,
    "complexityScore": 58.5,
    "learningDifficulty": "Intermediate"
  },
  "breakdown": {
    "recentCommits12w": 18,
    "contributorCount": 12,
    "languageCount": 3,
    "repoSizeKB": 4800,
    "openIssues": 8,
    "topicCount": 3,
    "isArchived": false,
    "hasDependencyFile": true
  },
  "formulas": { ... }
}
```

### Sample 3: LabelLab (Advanced)
```json
{
  "repository": "c2siorg/LabelLab",
  "generatedAt": "2026-03-15T00:00:00Z",
  "scores": {
    "activityScore": 95.0,
    "complexityScore": 82.0,
    "learningDifficulty": "Advanced"
  },
  "breakdown": {
    "recentCommits12w": 45,
    "contributorCount": 25,
    "languageCount": 4,
    "repoSizeKB": 12500,
    "openIssues": 10,
    "topicCount": 3,
    "isArchived": false,
    "hasDependencyFile": false
  },
  "formulas": { ... }
}
```
