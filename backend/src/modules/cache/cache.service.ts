import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import NodeCache from 'node-cache';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly l1Cache: NodeCache;
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    // L1: In-process cache
    this.l1Cache = new NodeCache({
      stdTTL: 60,
      checkperiod: 30,
      useClones: false, // Performance: avoid deep cloning on get
    });

    // L2: Redis
    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number): number | null => {
        if (times > 5) {
          this.logger.error('Redis connection failed after 5 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    this.redis.on('error', (err: Error) => {
      this.logger.error(`Redis error: ${err.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    // Connect eagerly
    this.redis.connect().catch((err: Error) => {
      this.logger.error(`Redis initial connection failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.l1Cache.close();
    await this.redis.quit();
    this.logger.log('Cache connections closed');
  }

  /**
   * Get a value from cache. Checks L1 first, then L2 (Redis).
   * On L2 hit, populates L1 before returning.
   */
  async get<T>(key: string): Promise<T | null> {
    // L1 check
    const l1Value = this.l1Cache.get<T>(key);
    if (l1Value !== undefined) {
      return l1Value;
    }

    // L2 check
    try {
      const l2Value = await this.redis.get(key);
      if (l2Value !== null) {
        const parsed = JSON.parse(l2Value) as T;
        // Populate L1 on L2 hit
        this.l1Cache.set(key, parsed, 60);
        return parsed;
      }
    } catch (err) {
      this.logger.warn(
        `Redis GET error for key "${key}": ${(err as Error).message}`,
      );
    }

    return null;
  }

  /**
   * Set a value in both L1 and L2 caches.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    // L1: shorter TTL
    const l1Ttl = Math.min(ttlSeconds, 60);
    this.l1Cache.set(key, value, l1Ttl);

    // L2: Redis
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSeconds, serialized);
    } catch (err) {
      this.logger.warn(
        `Redis SET error for key "${key}": ${(err as Error).message}`,
      );
    }
  }

  /**
   * Delete a specific key from both cache tiers.
   */
  async del(key: string): Promise<void> {
    this.l1Cache.del(key);
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(
        `Redis DEL error for key "${key}": ${(err as Error).message}`,
      );
    }
  }

  /**
   * Delete all keys matching a pattern (e.g. 'repo:list:*').
   * Uses Redis SCAN to avoid blocking the server.
   */
  async delPattern(pattern: string): Promise<void> {
    // L1: flush all matching keys (node-cache doesn't support pattern delete)
    const allL1Keys = this.l1Cache.keys();
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const k of allL1Keys) {
      if (regex.test(k)) {
        this.l1Cache.del(k);
      }
    }

    // L2: Use SCAN to find and delete matching keys
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(
        `Redis SCAN/DEL error for pattern "${pattern}": ${(err as Error).message}`,
      );
    }
  }

  /**
   * Acquire a lock for cache stampede prevention.
   * Returns true if lock acquired, false if already locked.
   */
  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    try {
      const result = await this.redis.set(
        `lock:${key}`,
        '1',
        'PX',
        ttlMs,
        'NX',
      );
      return result === 'OK';
    } catch (err) {
      this.logger.warn(
        `Redis lock error for key "${key}": ${(err as Error).message}`,
      );
      return true; // On Redis failure, allow the query to proceed
    }
  }

  /**
   * Release a lock.
   */
  async releaseLock(key: string): Promise<void> {
    try {
      await this.redis.del(`lock:${key}`);
    } catch (err) {
      this.logger.warn(
        `Redis unlock error for key "${key}": ${(err as Error).message}`,
      );
    }
  }

  /**
   * Wait for a lock to be released, then return the cached value.
   * Used when another worker is already populating the cache.
   */
  async waitForValue<T>(
    key: string,
    maxWaitMs: number = 5000,
  ): Promise<T | null> {
    const pollInterval = 100;
    let waited = 0;

    while (waited < maxWaitMs) {
      const value = await this.get<T>(key);
      if (value !== null) {
        return value;
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      waited += pollInterval;
    }

    return null;
  }

  /**
   * Get the underlying Redis instance (for ETag storage, BullMQ, etc.)
   */
  getRedisClient(): Redis {
    return this.redis;
  }
}
