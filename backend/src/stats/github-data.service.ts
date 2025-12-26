import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export type NormalizedStats = {
  stars: number;
  publicRepos: number;
  prs: number;
  commits: number;
  contributions: number;
  streak: number;
};

export type FetchResult = {
  stats: NormalizedStats;
  accuracy: 'accurate' | 'approximate' | 'partial';
};

@Injectable()
export class GitHubDataService {
  private readonly logger = new Logger(GitHubDataService.name);

  private buildHeaders(token?: string) {
    const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'DevGrid-Stats' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  // Fetch and normalize multiple requests; return partial data if some calls fail
  async fetchStatsForUser(username: string, token?: string): Promise<FetchResult> {
    const headers = this.buildHeaders(token);
    let partial = false;

    const sinceDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const since = sinceDate.toISOString().slice(0, 10);

    const result: NormalizedStats = { stars: 0, publicRepos: 0, prs: 0, commits: 0, contributions: 0, streak: 0 };

    try {
      // user info
      try {
        const u = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers, validateStatus: () => true });
        if (u.status === 200 && u.data) result.publicRepos = Number(u.data.public_repos || 0);
        else this.logger.debug(`GitHub user info returned status ${u.status} for ${username}`);
      } catch (e) {
        partial = true;
        this.logger.debug('GitHub user fetch failed', (e as any)?.message || e);
      }

      // repos -> stars
      try {
        let page = 1;
        while (true) {
          const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}/repos`, { params: { per_page: 100, page }, headers, validateStatus: () => true });
          if (res.status !== 200 || !Array.isArray(res.data) || res.data.length === 0) break;
          for (const r of res.data) result.stars += Number(r.stargazers_count || 0);
          if (res.data.length < 100) break;
          page++;
        }
      } catch (e) {
        partial = true;
        this.logger.debug('GitHub repos fetch failed', (e as any)?.message || e);
      }

      // PRs via search
      try {
        const q = `author:${username} type:pr created:>=${since}`;
        const res = await axios.get('https://api.github.com/search/issues', { params: { q, per_page: 1 }, headers, validateStatus: () => true });
        if (res.status === 200 && res.data && typeof res.data.total_count === 'number') result.prs = Number(res.data.total_count || 0);
        else this.logger.debug(`GitHub PR search returned status ${res.status} for ${username}`);
      } catch (e) {
        partial = true;
        this.logger.debug('GitHub PRs fetch failed', (e as any)?.message || e);
      }

      // events -> contributions + commits + streak (approx)
      try {
        const events: any[] = [];
        let page = 1;
        const maxPages = 3;
        while (page <= maxPages) {
          const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}/events`, { params: { per_page: 100, page }, headers, validateStatus: () => true });
          if (res.status !== 200 || !Array.isArray(res.data) || res.data.length === 0) break;
          events.push(...res.data);
          if (res.data.length < 100) break;
          page++;
        }

        const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const eventsInYear = events.filter(e => new Date(e.created_at) >= cutoff);
        result.contributions = eventsInYear.length;
        result.commits = eventsInYear.reduce((sum, e) => {
          try {
            if (e.type === 'PushEvent' && e.payload && Array.isArray(e.payload.commits)) return sum + e.payload.commits.length;
          } catch (_) {}
          return sum;
        }, 0 as number);

        // streak approximate
        const daySet = new Set(eventsInYear.map(e => new Date(e.created_at).toISOString().slice(0,10)));
        let cur = new Date(); cur.setUTCHours(0,0,0,0);
        let curStreak = 0;
        while (true) {
          const dayStr = cur.toISOString().slice(0,10);
          if (daySet.has(dayStr)) { curStreak++; cur.setUTCDate(cur.getUTCDate() - 1); } else break;
        }
        result.streak = curStreak;
        if (!result.commits) result.commits = result.contributions;
      } catch (e) {
        partial = true;
        this.logger.debug('GitHub events fetch failed', (e as any)?.message || e);
      }
    } catch (e) {
      partial = true;
      this.logger.warn('Unexpected GitHub fetch error', (e as any)?.message || e);
    }

    const accuracy: FetchResult['accuracy'] = partial ? 'partial' : (token ? 'accurate' : 'approximate');

    return { stats: result, accuracy };
  }
}
