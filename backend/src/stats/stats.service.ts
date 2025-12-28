import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma.service';
import { GitHubDataService } from './github-data.service';
import { themePalette } from './svg-options.util';
import { GitHubTokenService, GitHubReconnectRequired } from '../auth/github-token.service';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);
  private readonly ttlSeconds: number;

  constructor(private readonly redis: RedisService, private readonly prisma: PrismaService, private readonly gh: GitHubDataService, private readonly tokenService: GitHubTokenService) {
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

    // Generate GitHub-backed stats via GitHubDataService on cache miss
    // Do NOT read JWT/session here — token selection for the public path uses app token if available
    const name = this.normalizeUsername(username);
    // token selection for public generation: prefer app token if present, otherwise unauthenticated
    const appToken = process.env.GITHUB_TOKEN;
    const tokenToUse = appToken ? String(appToken) : undefined;
    const tokenSource: 'app' | 'none' = appToken ? 'app' : 'none';

    let stars = 0;
    let publicRepos = 0;
    let prs = 0;
    let commits = 0;
    let contributions = 0;
    let streak = 0;
    let accuracy: 'accurate' | 'approximate' | 'partial' = 'approximate';

    try {
      const res = await this.gh.fetchStatsForUser(name, tokenToUse);
      stars = res.stats.stars;
      publicRepos = res.stats.publicRepos;
      prs = res.stats.prs;
      commits = res.stats.commits;
      contributions = res.stats.contributions;
      streak = res.stats.streak;
      accuracy = res.accuracy;
    } catch (e) {
      this.logger.warn('Failed to fetch GitHub stats', (e as any)?.message || e);
      accuracy = 'partial';
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

    // canonical keys we'll render (2 rows x 3 cols)
    const rows = [
      [ { key: 'stars', label: 'Stars', value: String(stars) }, { key: 'repos', label: 'Repos', value: String(publicRepos) }, { key: 'prs', label: 'PRs (1y)', value: String(prs) } ],
      [ { key: 'commits', label: 'Commits', value: String(commits) }, { key: 'contributions', label: 'Activity', value: String(contributions) }, { key: 'streak', label: 'Streak', value: `${streak}d` } ],
    ];

    const innerPad = 22;
    // recompute height to ensure headings and numbers have room (avoid clipping)
    const contentHeight = layout === 'compact' ? 180 : (layout === 'wide' ? 260 : 240);
    height = contentHeight;
    const colWidth = Math.floor((width - innerPad * 2) / 3);
    const headerY = 30; // title baseline (moved down for visibility)
    const nameY = headerY + 22; // username baseline below title
    const statsStartY = nameY + 36; // space before numbers
    const rowSpacing = layout === 'compact' ? 72 : (layout === 'wide' ? 110 : 90);

    // number sizes: prominent but not overflowing; labels smaller
    const numFont = layout === 'compact' ? 28 : (layout === 'wide' ? 40 : 34);
    const labelFont = layout === 'compact' ? 12 : (layout === 'wide' ? 14 : 13);

    // helper to render a cell centered in its column using absolute coordinates
    function renderCell(colIndex: number, rowIndex: number, item: { key: string; label: string; value: string }) {
      const key = item.key;
      if (hideSet.has(key)) return '';
      const colLeft = innerPad + colIndex * colWidth;
      const centerX = colLeft + Math.floor(colWidth / 2);
      const numberY = statsStartY + rowIndex * rowSpacing; // absolute Y for number baseline
      const labelY = numberY + Math.round(numFont * 0.9) + 8;
      // Use text-anchor middle so x is center
      return `<text x="${centerX}" y="${numberY}" text-anchor="middle" fill="${palette.text}" font-size="${numFont}" font-weight="800" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${item.value}</text>` +
             `<text x="${centerX}" y="${labelY}" text-anchor="middle" fill="${palette.subtext}" font-size="${labelFont}" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${item.label}</text>`;
    }

    // vertical dividers (between columns) - lighter and shorter so not full height
    const dividerX1 = innerPad + colWidth;
    const dividerX2 = innerPad + colWidth * 2;

    // Build a minimal, clean card-style SVG
    const svgParts: string[] = [];
    svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="DevGrid stats for ${name}">`);

    // border color and opacity (use palette.border when provided)
    const borderColor = (palette as any).border || palette.subtext;
    const borderOpacity = (String(opts.theme || 'dark').toLowerCase() === 'dark') ? 0.9 : 0.14;

    // outer rounded card
    svgParts.push(`<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${palette.card}" stroke="${borderColor}" stroke-opacity="${hideBorder ? '0' : String(borderOpacity)}" stroke-width="1" />`);

    // Header (title + username)
    svgParts.push(`<text x="${innerPad}" y="${headerY}" fill="${palette.text}" font-size="18" font-weight="800" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>`);
    svgParts.push(`<text x="${innerPad}" y="${nameY}" fill="${palette.accent}" font-size="14" font-weight="700" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${name}</text>`);

    // Compute visible items flattening rows order left->right top->bottom
    const visibleItems = [] as { key: string; label: string; value: string }[];
    for (const row of rows) {
      for (const item of row) {
        if (!hideSet.has(item.key)) visibleItems.push(item as any);
      }
    }

    // If all hidden, show placeholders for first row
    if (visibleItems.length === 0) {
      visibleItems.push({ key: 'stars', label: 'Stars', value: '0' }, { key: 'repos', label: 'Repos', value: '0' }, { key: 'prs', label: 'PRs (1y)', value: '0' });
    }

    // Layout: evenly distribute up to 3 columns
    const cols = Math.min(3, Math.max(1, visibleItems.length));
    const colW = Math.floor((width - innerPad * 2) / cols);
    const baseY = statsStartY; // top position for first row numbers

    // render visible items in columns in two rows if needed
    for (let i = 0; i < visibleItems.length; i++) {
      const col = i % cols;
      const rowIdx = Math.floor(i / cols);
      const centerX = innerPad + col * colW + Math.floor(colW / 2);
      const numberY = baseY + rowIdx * (rowSpacing);
      const labelY = numberY + Math.round(numFont * 0.9) + 8;
      const it = visibleItems[i];
      svgParts.push(`<text x="${centerX}" y="${numberY}" text-anchor="middle" fill="${palette.text}" font-size="${numFont}" font-weight="700" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${it.value}</text>`);
      svgParts.push(`<text x="${centerX}" y="${labelY}" text-anchor="middle" fill="${palette.subtext}" font-size="${labelFont}" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${it.label}</text>`);
    }

    // gentle vertical dividers between columns if more than one column
    if (cols > 1) {
      for (let c = 1; c < cols; c++) {
        const x = innerPad + c * colW;
        svgParts.push(`<line x1="${x}" y1="${baseY - 12}" x2="${x}" y2="${height - 14}" stroke="${borderColor}" stroke-opacity="${hideBorder ? '0' : '0.06'}" stroke-width="1" />`);
      }
    }

    svgParts.push(`</svg>`);
    // If accuracy is not 'accurate', add a subtle footnote under the username
    if (accuracy !== 'accurate') {
      const noteY = nameY + 16;
      const noteText = accuracy === 'partial' ? 'Data may be incomplete' : 'Approximate data';
      svgParts.splice( svgParts.findIndex(p => p.includes(`<text x="${innerPad}" y="${nameY}"`)) + 1, 0, `<text x="${innerPad}" y="${noteY}" fill="${palette.subtext}" font-size="11" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${noteText}</text>` );
    }

    const svg = svgParts.join('');

    // Choose TTL depending on accuracy and token source
    const TTL_USER = Number(process.env.STATS_TTL_USER_SEC || '28800'); // 8h
    const TTL_APP = Number(process.env.STATS_TTL_APP_SEC || '14400'); // 4h
    const TTL_UNAUTH = Number(process.env.STATS_TTL_UNAUTH_SEC || '5400'); // 1.5h
    const TTL_ERROR = Number(process.env.STATS_TTL_ERROR_SEC || '600'); // 10m

    let effectiveTtl = this.ttlSeconds;
    if (accuracy === 'partial') effectiveTtl = TTL_ERROR;
    else if (tokenSource === 'app' && accuracy === 'accurate') effectiveTtl = TTL_APP;
    else if (tokenSource === 'none' && accuracy === 'accurate') effectiveTtl = TTL_UNAUTH;

    try {
      await this.redis.set(key, svg, effectiveTtl);
      this.logger.debug(`Stats cached for ${key} (ttl=${effectiveTtl}s, accuracy=${accuracy}, tokenSource=${tokenSource})`);
    } catch (e) {
      this.logger.warn('Redis set failed, continuing without cache', (e as any)?.message || e);
    }

    return svg;
  }

  // This method is to be used by authenticated flows (server-side) to populate cache
  // It will use the user's stored GitHub token (if any) to generate a higher-confidence SVG.
  async generateAndCacheForUser(username: string, userId: string, type = 'demo', options?: Record<string, any>) {
    const key = this.makeCacheKey(username, type, options);
      // find or refresh user token via central token service
      try {
        let tokenToUse: string | undefined;
        try {
          tokenToUse = await this.tokenService.getValidGitHubAccessToken(userId);
        } catch (e) {
          if (e instanceof GitHubReconnectRequired) {
            // mark as no valid user token
            tokenToUse = undefined;
          } else throw e;
        }
        const tokenSource: 'user' | 'app' | 'none' = tokenToUse ? 'user' : (process.env.GITHUB_TOKEN ? 'app' : 'none');
        let statsRes;
        try {
          const tokenToCall = tokenToUse ? tokenToUse : (process.env.GITHUB_TOKEN ? String(process.env.GITHUB_TOKEN) : undefined);
          statsRes = await this.gh.fetchStatsForUser(this.normalizeUsername(username), tokenToCall);
        } catch (e) {
          this.logger.warn('generateAndCacheForUser: GitHub fetch failed', (e as any)?.message || e);
          statsRes = { stats: { stars: 0, publicRepos: 0, prs: 0, commits: 0, contributions: 0, streak: 0 }, accuracy: 'partial' as const };
        }

      // Build SVG using same renderer code path by reusing getSvgForUser?:
      // Call the main generator but skip reading cache by forcing a new fetch; reuse options.
      // For simplicity, we will generate the SVG text directly using the same logic path by temporarily
      // writing the fetched stats into the service path: call a small internal renderer function.
      // For now, reuse existing getSvgForUser logic by setting process.env.GITHUB_TOKEN to tokenToUse is NOT acceptable.
      // Instead, store a small helper: renderSvgFromStats
      const svg = await this.renderSvgFromStats(username, statsRes.stats, options || {}, statsRes.accuracy);

      // TTL selection
      const TTL_USER = Number(process.env.STATS_TTL_USER_SEC || '28800');
      const TTL_APP = Number(process.env.STATS_TTL_APP_SEC || '14400');
      const TTL_ERROR = Number(process.env.STATS_TTL_ERROR_SEC || '600');
      let effectiveTtl = TTL_ERROR;
      if (statsRes.accuracy === 'accurate' && tokenSource === 'user') effectiveTtl = TTL_USER;
      else if (statsRes.accuracy === 'accurate' && tokenSource === 'app') effectiveTtl = TTL_APP;

      await this.redis.set(key, svg, effectiveTtl);
      this.logger.debug(`generateAndCacheForUser cached ${key} ttl=${effectiveTtl} source=${tokenSource} accuracy=${statsRes.accuracy}`);
      return svg;
    } catch (e) {
      this.logger.warn('generateAndCacheForUser failed', (e as any)?.message || e);
      throw e;
    }
  }

  // Helper: render SVG from already-fetched stats. This mirrors rendering logic above but uses provided stats.
  private async renderSvgFromStats(username: string, fetched: { stars: number; publicRepos: number; prs: number; commits: number; contributions: number; streak: number }, options: Record<string, any>, accuracy: 'accurate'|'approximate'|'partial') {
    // We'll reuse much of the rendering code above: to avoid duplication, keep it minimal and produce the same output.
    const opts = options || {} as Record<string, any>;
    const palette = themePalette(opts.theme || 'dark');
    const layout = String(opts.layout || 'default');
    let width = 560; let height = 160;
    if (layout === 'compact') { width = 420; height = 180; } else if (layout === 'wide') { width = 760; height = 240; }
    const innerPad = 22;
    const headerY = 30;
    const nameY = headerY + 22;
    const statsStartY = nameY + 36;
    const numFont = layout === 'compact' ? 28 : (layout === 'wide' ? 40 : 34);
    const labelFont = layout === 'compact' ? 12 : (layout === 'wide' ? 14 : 13);

    const rows = [
      [{ key: 'stars', label: 'Stars', value: String(fetched.stars) }, { key: 'repos', label: 'Repos', value: String(fetched.publicRepos) }, { key: 'prs', label: 'PRs (1y)', value: String(fetched.prs) }],
      [{ key: 'commits', label: 'Commits', value: String(fetched.commits) }, { key: 'contributions', label: 'Activity', value: String(fetched.contributions) }, { key: 'streak', label: 'Streak', value: `${fetched.streak}d` }],
    ];

    const svgParts: string[] = [];
    svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="DevGrid stats for ${username}">`);
    const borderColor = (palette as any).border || palette.subtext;
    svgParts.push(`<rect x="0.5" y="0.5" width="${width-1}" height="${height-1}" rx="10" fill="${palette.card}" stroke="${borderColor}" stroke-opacity="0.12" stroke-width="1" />`);
    svgParts.push(`<text x="${innerPad}" y="${headerY}" fill="${palette.text}" font-size="18" font-weight="800" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>`);
    svgParts.push(`<text x="${innerPad}" y="${nameY}" fill="${palette.accent}" font-size="14" font-weight="700" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${username}</text>`);
    if (accuracy !== 'accurate') svgParts.push(`<text x="${innerPad}" y="${nameY + 16}" fill="${palette.subtext}" font-size="11">${accuracy==='partial'?'Data may be incomplete':'Approximate data'}</text>`);

    const cols = 3;
    const colW = Math.floor((width - innerPad * 2) / cols);
    const baseY = statsStartY;
    for (let i = 0; i < rows.flat().length; i++) {
      const col = i % cols; const rowIdx = Math.floor(i / cols);
      const centerX = innerPad + col * colW + Math.floor(colW/2);
      const numberY = baseY + rowIdx * 90;
      const it = rows.flat()[i];
      svgParts.push(`<text x="${centerX}" y="${numberY}" text-anchor="middle" fill="${palette.text}" font-size="${numFont}" font-weight="700" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${it.value}</text>`);
      svgParts.push(`<text x="${centerX}" y="${numberY + Math.round(numFont*0.9) + 8}" text-anchor="middle" fill="${palette.subtext}" font-size="${labelFont}" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${it.label}</text>`);
    }

    svgParts.push(`</svg>`);
    return svgParts.join('');
  }
}
