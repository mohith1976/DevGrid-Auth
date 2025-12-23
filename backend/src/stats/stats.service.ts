import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import axios from 'axios';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);
  private readonly ttlSeconds: number;

  constructor(private readonly redis: RedisService) {
    const env = Number(process.env.STATS_CACHE_TTL_SECONDS || '300');
    this.ttlSeconds = Number.isFinite(env) && env > 0 ? env : 300;
  }

  private serializeOptions(options?: Record<string, any>) {
    if (!options || Object.keys(options).length === 0) return 'default';
    const keys = Object.keys(options).sort();
    const pairs = keys.map(k => `${k}=${String(options[k])}`);
    return encodeURIComponent(pairs.join('&'));
  }

  private makeCacheKey(username: string, type = 'demo', options?: Record<string, any>) {
    const user = String(username || 'demo').toLowerCase();
    const opt = this.serializeOptions(options);
    // key format: stats:svg:{type}:{username}:{opts}
    return `stats:svg:${type}:${user}:${opt}`;
  }

  async getSvgForUser(username: string, type = 'demo', options?: Record<string, any>): Promise<string> {
    const key = this.makeCacheKey(username, type, options);

    try {
      const cached = await this.redis.get<string>(key);
      if (cached) {
        this.logger.log(`Stats cache hit for ${key}`);
        // increment global and per-user hit counters (best-effort)
        try {
          const client = this.redis.getClient();
          if (client) {
            // global hit counter
            client.incr('stats:metrics:hits').catch(()=>{});
            // per-user hit counter
            client.incr(`stats:metrics:hits:${String(username || 'demo').toLowerCase()}`).catch(()=>{});
          }
        } catch (e) {
          // ignore metric failures
        }
        return cached;
      }
    } catch (e) {
      this.logger.warn('Redis get failed, proceeding without cache', (e as any)?.message || e);
    }

    // cache miss - log and increment miss counters
    this.logger.log(`Stats cache miss for ${key}`);
    try {
      const client = this.redis.getClient();
      if (client) {
        client.incr('stats:metrics:misses').catch(()=>{});
        client.incr(`stats:metrics:misses:${String(username || 'demo').toLowerCase()}`).catch(()=>{});
      }
    } catch (e) {
      // ignore metric failures
    }

    // Generate GitHub-backed SVG on cache miss
    // Always return an SVG even if some fetches fail.
    const name = String(username || 'demo');
    const sinceDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const since = sinceDate.toISOString().slice(0, 10);

    let stars = 0;
    let publicRepos = 0;
    let prs = 0;
    let commits = 0;
    let contributions = 0;
    let streak = 0;

    try {
      // 1) Basic user info
      try {
        const u = await axios.get(`https://api.github.com/users/${encodeURIComponent(name)}`, { headers: { Accept: 'application/vnd.github.v3+json' }, validateStatus: () => true });
        if (u.status === 200 && u.data) publicRepos = Number(u.data.public_repos || 0);
      } catch (e) {}

      // 2) Sum stars across repos (paginate)
      try {
        let page = 1;
        while (true) {
          const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(name)}/repos`, { params: { per_page: 100, page }, headers: { Accept: 'application/vnd.github.v3+json' }, validateStatus: () => true });
          if (res.status !== 200 || !Array.isArray(res.data) || res.data.length === 0) break;
          for (const r of res.data) stars += Number(r.stargazers_count || 0);
          if (res.data.length < 100) break;
          page++;
        }
      } catch (e) {}

      // 3) PRs in last year via search API
      try {
        const q = `author:${name} type:pr created:>=${since}`;
        const res = await axios.get('https://api.github.com/search/issues', { params: { q, per_page: 1 }, headers: { Accept: 'application/vnd.github.v3+json' }, validateStatus: () => true });
        if (res.status === 200 && res.data && typeof res.data.total_count === 'number') prs = Number(res.data.total_count || 0);
      } catch (e) {}

      // 4) Contributions & streak: approximate using REST events API (/users/:username/events)
      try {
        const events: any[] = [];
        let page = 1;
        const maxPages = 3; // limit pages to avoid excessive requests (safe default)
        while (page <= maxPages) {
          const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(name)}/events`, {
            params: { per_page: 100, page },
            headers: { Accept: 'application/vnd.github.v3+json' },
            validateStatus: () => true,
          });
          if (res.status !== 200 || !Array.isArray(res.data) || res.data.length === 0) break;
          events.push(...res.data);
          if (res.data.length < 100) break;
          page++;
        }

        const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const eventsInYear = events.filter(e => new Date(e.created_at) >= cutoff);

        // contributions: approximate as number of public events in last year
        contributions = eventsInYear.length;

        // commits: sum commits from PushEvent payloads
        commits = eventsInYear.reduce((sum, e) => {
          try {
            if (e.type === 'PushEvent' && e.payload && Array.isArray(e.payload.commits)) return sum + e.payload.commits.length;
          } catch (_) {}
          return sum;
        }, 0 as number);

        // streak: consecutive days with any event up to today (approximate)
        const daySet = new Set(eventsInYear.map(e => new Date(e.created_at).toISOString().slice(0,10)));
        let cur = new Date();
        cur.setUTCHours(0,0,0,0);
        let curStreak = 0;
        while (true) {
          const dayStr = cur.toISOString().slice(0,10);
          if (daySet.has(dayStr)) {
            curStreak++;
            cur.setUTCDate(cur.getUTCDate() - 1);
          } else break;
        }
        streak = curStreak;

        if (!commits) commits = contributions;
      } catch (e) {}
    } catch (e) {
      this.logger.warn('Failed to fetch GitHub stats', (e as any)?.message || e);
    }

    // Build single SVG combining stats
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="560" height="140" viewBox="0 0 560 140" role="img" aria-label="DevGrid stats for ${name}">
  <rect width="100%" height="100%" fill="#0b1226" rx="8"/>
  <text x="28" y="36" fill="#ffffff" font-size="20" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>
  <text x="28" y="62" fill="#9aa4c0" font-size="14" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${name}</text>
    <g transform="translate(28,86)" fill="#9aa4c0" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="12">
    <text x="0" y="0">⭐ Stars: ${stars}</text>
    <text x="140" y="0">📦 Repos: ${publicRepos}</text>
    <text x="280" y="0">🔀 PRs (1y): ${prs}</text>
    <text x="0" y="20">🧮 Recent Commits: ${commits}</text>
    <text x="140" y="20">🔥 Recent Activity: ${contributions}</text>
    <text x="340" y="20">⏱ Streak: ${streak}d</text>
  </g>
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
