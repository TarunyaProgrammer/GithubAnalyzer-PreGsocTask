import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { SYNC_QUEUE_NAME } from '../sync/sync.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  
  // 1-hour hard expiration for deduplication keys.
  // GitHub deliveries usually happen instantly, any retries are typically within minutes.
  private readonly DEDUPLICATION_TTL_SECONDS = 3600;

  constructor(
    @InjectQueue(SYNC_QUEUE_NAME) private readonly syncQueue: Queue,
  ) {}

  /**
   * Attempts to set a delivery ID in Redis via SETNX.
   * Returns `true` if this is a new event (we set it).
   * Returns `false` if it already exists (duplicate).
   */
  async deduplicateEvent(deliveryId: string): Promise<boolean> {
    const key = `github:webhook:delivery:${deliveryId}`;
    
    try {
      const client = await this.syncQueue.client;
      // Use ioredis from bullmq
      const result = await client.set(
        key,
        'processing',
        'EX',
        this.DEDUPLICATION_TTL_SECONDS,
        'NX',
      );
      
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Error attempting to deduplicate delivery ${deliveryId}`, error);
      // Fail open to avoid dropping valid events due to Redis issues briefly.
      // Sync processing is somewhat idempotent anyway.
      return true; 
    }
  }
}
