import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);
  private readonly ttlSeconds: number;

  constructor(private readonly redis: RedisService) {
    const env = Number(process.env.STATS_CACHE_TTL_SECONDS || '300');
    this.ttlSeconds = Number.isFinite(env) && env > 0 ? env : 300;
  }

  private makeCacheKey(username: string) {
    return `stats:svg:${String(username || 'demo').toLowerCase()}`;
  }

  async getSvgForUser(username: string): Promise<string> {
    const key = this.makeCacheKey(username);

    try {
      const cached = await this.redis.get<string>(key);
      if (cached) {
        this.logger.debug(`Stats cache hit for ${key}`);
        return cached;
      }
    } catch (e) {
      this.logger.warn('Redis get failed, proceeding without cache', (e as any)?.message || e);
    }

    // Generate SVG (currently dummy content)
    const name = username || 'demo';
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="450" height="120" viewBox="0 0 450 120" role="img" aria-label="DevGrid stats for ${name}">
  <rect width="100%" height="100%" fill="#0b1226" rx="6"/>
  <text x="24" y="40" fill="#ffffff" font-size="20" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>
  <text x="24" y="70" fill="#9aa4c0" font-size="14" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${name}</text>
  <text x="24" y="95" fill="#9aa4c0" font-size="12" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">Commits: 123 • PRs: 45 • Stars: 10</text>
</svg>`;

    // Store in cache (best-effort)
    try {
      await this.redis.set(key, svg, this.ttlSeconds);
      this.logger.debug(`Stats cached for ${key} (ttl=${this.ttlSeconds}s)`);
    } catch (e) {
      this.logger.warn('Redis set failed, continuing without cache', (e as any)?.message || e);
    }

    return svg;
  }
}
