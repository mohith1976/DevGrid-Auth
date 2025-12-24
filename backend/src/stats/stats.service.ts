import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import axios from 'axios';
import { themePalette } from './svg-options.util';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);
  private readonly ttlSeconds: number;

  constructor(private readonly redis: RedisService) {
    const env = Number(process.env.STATS_CACHE_TTL_SECONDS || '7200');
    this.ttlSeconds = Number.isFinite(env) && env > 0 ? env : 7200;
  }

  private serializeOptions(options?: Record<string, any>) {
    if (!options || Object.keys(options).length === 0) return 'default';
    const keys = Object.keys(options).sort();
    const pairs = keys.map(k => `${k}=${String(options[k])}`);
    return encodeURIComponent(pairs.join('&'));
  }

  private normalizeUsername(username?: string) {
    return String(username || 'demo').replace(/\.svg$/i, '').trim();
  }

  private makeCacheKey(username: string, type = 'demo', options?: Record<string, any>) {
    const user = this.normalizeUsername(username).toLowerCase();
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
    const name = this.normalizeUsername(username);
    const ghToken = process.env.GITHUB_TOKEN;
    const authHeader = ghToken ? { Authorization: `Bearer ${ghToken}` } : {};
    const ghHeaders = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'DevGrid-Stats', ...authHeader };
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
        const u = await axios.get(`https://api.github.com/users/${encodeURIComponent(name)}`, { headers: ghHeaders, validateStatus: () => true });
        if (u.status === 200 && u.data) publicRepos = Number(u.data.public_repos || 0);
      } catch (e) {}

      // 2) Sum stars across repos (paginate)
      try {
        let page = 1;
        while (true) {
          const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(name)}/repos`, { params: { per_page: 100, page }, headers: ghHeaders, validateStatus: () => true });
          if (res.status !== 200 || !Array.isArray(res.data) || res.data.length === 0) break;
          for (const r of res.data) stars += Number(r.stargazers_count || 0);
          if (res.data.length < 100) break;
          page++;
        }
      } catch (e) {}

      // 3) PRs in last year via search API
      try {
        const q = `author:${name} type:pr created:>=${since}`;
        const res = await axios.get('https://api.github.com/search/issues', { params: { q, per_page: 1 }, headers: ghHeaders, validateStatus: () => true });
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
            headers: ghHeaders,
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

    // Visual options (presentation-only)
    const opts = (options || {}) as Record<string, any>;
    const palette = themePalette(opts.theme || 'dark');
    // layout sizing
    const layout = String(opts.layout || 'default');
    let width = 560;
    let height = 140;
    let spacingY = 20;
    if (layout === 'compact') {
      width = 420; height = 110; spacingY = 18;
    } else if (layout === 'wide') {
      width = 760; height = 140; spacingY = 22;
    }

    const hideSet = new Set<string>((opts.hide || []).map((s: any) => String(s).toLowerCase()));
    const showSet = new Set<string>((opts.show || []).map((s: any) => String(s).toLowerCase()));
    const hideBorder = Boolean(opts.hide_border);

    function renderSection(x: number, y: number, label: string, value: string, key: string) {
      if (hideSet.has(key)) return '';
      return `<g transform="translate(${x},${y})"><text x="0" y="0" fill="${palette.subtext}" font-size="12" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${label}</text><text x="0" y="16" fill="${palette.text}" font-size="16" font-weight="600" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${value}</text></g>`;
    }

    // Build single SVG combining stats (presentation-only modifications)
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="DevGrid stats for ${name}">` +
      `<rect width="100%" height="100%" fill="${palette.card}" rx="8"${hideBorder ? '' : ' stroke="#1f2a44" stroke-opacity="0.06"'} />` +
      `<g transform="translate(24,28)">` +
      `<text x="0" y="0" fill="${palette.text}" font-size="18" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>` +
      `<text x="0" y="22" fill="${palette.subtext}" font-size="13" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${name}</text>` +
      `</g>` +
      `<g transform="translate(24,${60})">` +
      renderSection(0, 0, 'Stars', String(stars), 'stars') +
      renderSection(160, 0, 'Repos', String(publicRepos), 'repos') +
      renderSection(320, 0, 'PRs (1y)', String(prs), 'prs') +
      renderSection(0, 48, 'Commits', String(commits), 'commits') +
      renderSection(160, 48, 'Activity', String(contributions), 'contributions') +
      renderSection(320, 48, 'Streak', `${streak}d`, 'streak') +
      `</g>` +
      `</svg>`;

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
