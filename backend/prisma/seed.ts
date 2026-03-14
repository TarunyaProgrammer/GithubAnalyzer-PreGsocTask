import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed script — inserts 10 real C2SI repositories for local development.
 * Uses ON CONFLICT (upsert) so it's safe to run multiple times.
 */
async function main(): Promise<void> {
  console.log('🌱 Seeding database with C2SI repositories...');

  const repos = [
    {
      id: BigInt(131649498),
      name: 'OpenIoE',
      fullName: 'c2siorg/OpenIoE',
      description: 'OpenIoE is an Open Internet of Everything platform',
      htmlUrl: 'https://github.com/c2siorg/OpenIoE',
      starsCount: 18,
      forksCount: 12,
      openIssuesCount: 5,
      primaryLanguage: 'Java',
      topics: ['iot', 'open-source'],
      defaultBranch: 'master',
      githubCreatedAt: new Date('2018-05-02T00:00:00Z'),
    },
    {
      id: BigInt(180065043),
      name: 'LabelLab',
      fullName: 'c2siorg/LabelLab',
      description: 'LabelLab is an image labeling tool for researchers',
      htmlUrl: 'https://github.com/c2siorg/LabelLab',
      starsCount: 65,
      forksCount: 85,
      openIssuesCount: 10,
      primaryLanguage: 'Dart',
      topics: ['machine-learning', 'image-labeling', 'flutter'],
      defaultBranch: 'master',
      githubCreatedAt: new Date('2019-04-08T00:00:00Z'),
    },
    {
      id: BigInt(243811888),
      name: 'Scan8',
      fullName: 'c2siorg/Scan8',
      description: 'Scan8 is a distributed scanning system for URLs',
      htmlUrl: 'https://github.com/c2siorg/Scan8',
      starsCount: 12,
      forksCount: 20,
      openIssuesCount: 3,
      primaryLanguage: 'Python',
      topics: ['security', 'scanning'],
      defaultBranch: 'main',
      githubCreatedAt: new Date('2020-02-27T00:00:00Z'),
    },
    {
      id: BigInt(298373427),
      name: 'BugZero',
      fullName: 'c2siorg/BugZero',
      description: 'BugZero - A centralized platform for bug reporting',
      htmlUrl: 'https://github.com/c2siorg/BugZero',
      starsCount: 8,
      forksCount: 15,
      openIssuesCount: 2,
      primaryLanguage: 'JavaScript',
      topics: ['bug-tracking', 'web-app'],
      defaultBranch: 'main',
      githubCreatedAt: new Date('2020-09-24T00:00:00Z'),
    },
    {
      id: BigInt(268397540),
      name: 'ChainKeeper',
      fullName: 'c2siorg/ChainKeeper',
      description: 'Blockchain analytics and exploration platform',
      htmlUrl: 'https://github.com/c2siorg/ChainKeeper',
      starsCount: 15,
      forksCount: 18,
      openIssuesCount: 4,
      primaryLanguage: 'Python',
      topics: ['blockchain', 'analytics'],
      defaultBranch: 'main',
      githubCreatedAt: new Date('2020-06-01T00:00:00Z'),
    },
    {
      id: BigInt(148133708),
      name: 'Codelabz',
      fullName: 'c2siorg/Codelabz',
      description: 'CodeLabz is an online platform for tutorials and labs',
      htmlUrl: 'https://github.com/c2siorg/Codelabz',
      starsCount: 45,
      forksCount: 95,
      openIssuesCount: 15,
      primaryLanguage: 'JavaScript',
      topics: ['education', 'react', 'firebase'],
      defaultBranch: 'master',
      githubCreatedAt: new Date('2018-09-10T00:00:00Z'),
    },
    {
      id: BigInt(408419682),
      name: 'GDB-Frontend',
      fullName: 'c2siorg/GDB-Frontend',
      description: 'GDB Frontend is a GUI for GDB debugger',
      htmlUrl: 'https://github.com/c2siorg/GDB-Frontend',
      starsCount: 5,
      forksCount: 8,
      openIssuesCount: 1,
      primaryLanguage: 'Python',
      topics: ['debugging', 'gdb', 'gui'],
      defaultBranch: 'main',
      githubCreatedAt: new Date('2021-09-18T00:00:00Z'),
    },
    {
      id: BigInt(372801259),
      name: 'Webiu',
      fullName: 'c2siorg/Webiu',
      description: 'Webiu is the official website for C2SI built with React/Gatsby',
      htmlUrl: 'https://github.com/c2siorg/Webiu',
      starsCount: 35,
      forksCount: 70,
      openIssuesCount: 8,
      primaryLanguage: 'JavaScript',
      topics: ['website', 'gatsby', 'react'],
      defaultBranch: 'master',
      githubCreatedAt: new Date('2021-05-31T00:00:00Z'),
    },
    {
      id: BigInt(505621432),
      name: 'DSSP',
      fullName: 'c2siorg/DSSP',
      description: 'Data Science and Statistical Platform',
      htmlUrl: 'https://github.com/c2siorg/DSSP',
      starsCount: 3,
      forksCount: 5,
      openIssuesCount: 0,
      primaryLanguage: 'Python',
      topics: ['data-science', 'statistics'],
      defaultBranch: 'main',
      githubCreatedAt: new Date('2022-06-22T00:00:00Z'),
    },
    {
      id: BigInt(448562801),
      name: 'GlottologDB',
      fullName: 'c2siorg/GlottologDB',
      description: 'A database platform for linguistic data from Glottolog',
      htmlUrl: 'https://github.com/c2siorg/GlottologDB',
      starsCount: 6,
      forksCount: 10,
      openIssuesCount: 2,
      primaryLanguage: 'TypeScript',
      topics: ['linguistics', 'database'],
      defaultBranch: 'main',
      githubCreatedAt: new Date('2022-01-14T00:00:00Z'),
    },
  ];

  for (const repo of repos) {
    await prisma.repository.upsert({
      where: { id: repo.id },
      create: {
        ...repo,
        isArchived: false,
        isActive: true,
        syncedAt: new Date(),
      },
      update: {
        name: repo.name,
        description: repo.description,
        starsCount: repo.starsCount,
        forksCount: repo.forksCount,
        openIssuesCount: repo.openIssuesCount,
        primaryLanguage: repo.primaryLanguage,
        topics: repo.topics,
        syncedAt: new Date(),
      },
    });
    console.log(`  ✓ ${repo.fullName}`);
  }

  console.log(`\n✅ Seeded ${repos.length} repositories`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
