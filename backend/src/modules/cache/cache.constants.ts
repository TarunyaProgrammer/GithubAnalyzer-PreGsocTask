export const CACHE_KEYS = {
  repo: (id: bigint | string): string => `repo:${id}`,
  repoList: (cursor: string | null, perPage: number, sort: string, lang: string | null): string =>
    `repo:list:${cursor ?? 'first'}:${perPage}:${sort}:${lang ?? 'all'}`,
  repoSearch: (queryHash: string): string => `repo:search:${queryHash}`,
  contributors: (id: bigint | string): string => `repo:${id}:contributors`,
  languages: (id: bigint | string): string => `repo:${id}:languages`,
  activity: (id: bigint | string): string => `repo:${id}:activity`,
  stats: (): string => 'repo:stats',
};

export const CACHE_TTLS = {
  // L2 Redis TTLs (in seconds)
  REPO: 300,
  REPO_LIST: 300,
  REPO_SEARCH: 300,
  CONTRIBUTORS: 86400, // 24h
  LANGUAGES: 3600,     // 1h
  ACTIVITY: 3600,      // 1h
  STATS: 300,

  // L1 in-memory TTLs (in seconds)
  L1_DEFAULT: 60,
  L1_LIST: 60,
};
