import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { join } from 'path';

// Load .env explicitly for ts-node executions
config({ path: join(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set. Check your .env file.');
  process.exit(1);
}

const token = process.env.GITHUB_TOKEN;
const org = process.env.GITHUB_ORG || 'c2siorg';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Octokit } from '@octokit/rest';

// Let Postgres resolve localhost via DNS mapping (macOS Orbstack/Colima usually map it natively)
const pool = new Pool({ connectionString: databaseUrl });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

/**
 * Seed script — fetches all repositories in the configured GitHub org.
 * Uses ON CONFLICT (upsert) so it's safe to run multiple times.
 */
async function main(): Promise<void> {
  console.log(`🌱 Seeding database with repositories from org: ${org}...`);

  const octokit = new Octokit({ auth: token });
  const repos: any[] = [];
  let page = 1;

  try {
    while (true) {
      const response = await octokit.repos.listForOrg({
        org,
        type: 'public',
        per_page: 100,
        page,
      });
      repos.push(...response.data);
      if (response.data.length < 100) break;
      page++;
    }
  } catch (err) {
    console.error('❌ Failed to list org repos from GitHub:', err);
    process.exit(1);
  }

  console.log(`Found ${repos.length} repositories. Upserting into database...`);

  for (const repo of repos) {
    await prisma.repository.upsert({
      where: { id: BigInt(repo.id) },
      create: {
        id: BigInt(repo.id),
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        htmlUrl: repo.html_url,
        starsCount: repo.stargazers_count || 0,
        forksCount: repo.forks_count || 0,
        openIssuesCount: repo.open_issues_count || 0,
        primaryLanguage: repo.language,
        topics: repo.topics || [],
        defaultBranch: repo.default_branch || 'main',
        githubCreatedAt: repo.created_at ? new Date(repo.created_at) : new Date(),
        isArchived: repo.archived || false,
        isActive: true,
        syncedAt: new Date(),
      },
      update: {
        name: repo.name,
        description: repo.description,
        starsCount: repo.stargazers_count || 0,
        forksCount: repo.forks_count || 0,
        openIssuesCount: repo.open_issues_count || 0,
        primaryLanguage: repo.language,
        topics: repo.topics || [],
        isArchived: repo.archived || false,
        syncedAt: new Date(),
      },
    });
    console.log(`  ✓ ${repo.full_name}`);
  }

  console.log(`\n✅ Successfully seeded ${repos.length} repositories.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
