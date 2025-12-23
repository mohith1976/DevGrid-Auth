import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.log('REDIS_URL not configured — Redis client disabled');
      return;
    }
    try {
      this.client = new Redis(url);
      this.client.on('connect', () => this.logger.log('Redis connected'));
      this.client.on('error', (err) => this.logger.error('Redis error', err));
    } catch (e) {
      this.logger.error('Failed to initialize Redis client', (e as any)?.message || e);
      this.client = null;
    }
  }

  onModuleDestroy() {
    if (this.client) {
      try {
        this.client.quit().catch(()=>{});
      } catch (_) {}
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.client) return null;
    const v = await this.client.get(key);
    if (v == null) return null;
    try { return JSON.parse(v) as T; } catch { return v as unknown as T; }
  }

  async set(key: string, value: any, ttlSeconds?: number) {
    if (!this.client) return;
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, val, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, val);
    }
  }

  async del(key: string) {
    if (!this.client) return;
    await this.client.del(key);
  }
}
