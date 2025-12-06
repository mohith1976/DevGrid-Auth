import { Injectable, Logger } from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';
import axios from 'axios';
import { PrismaService } from '../prisma.service';
import { decrypt } from '../utils/crypto.util';
import { addLanguageJob } from '../queues/languageQueue';
import { profileEvents } from '../events/profile-events';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  constructor(private mongo: MongoService, private prisma: PrismaService) {}

  private computeLevel(percent: number) {
    // Return a numeric level 0-5 and label based on percentage
    if (percent <= 0) return { level: 0, label: 'None' };
    if (percent <= 5) return { level: 1, label: 'Novice' };
    if (percent <= 20) return { level: 2, label: 'Beginner' };
    if (percent <= 40) return { level: 3, label: 'Intermediate' };
    if (percent <= 70) return { level: 4, label: 'Advanced' };
    return { level: 5, label: 'Expert' };
  }

  // Infer languages by scanning repository tree (when /languages API is empty)
  private async inferLanguagesFromTree(owner: string, repo: string, headers: any, branch?: string) {
    let reposRes: any = null;
    try {
      const treeRef = branch || 'HEAD';
      const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeRef}?recursive=1`;
      const res = await axios.get(url, { headers, validateStatus: ()=>true });
      if (res.status !== 200 || !res.data || !Array.isArray(res.data.tree)) return {};
      const mapping: Record<string,string> = {
        'ts':'TypeScript','tsx':'TypeScript','js':'JavaScript','jsx':'JavaScript','py':'Python','java':'Java','c':'C','cpp':'C++','cc':'C++','cxx':'C++','cs':'C#','go':'Go','rb':'Ruby','php':'PHP','html':'HTML','css':'CSS','scss':'CSS','sass':'CSS','sh':'Shell','bash':'Shell','ps1':'Batchfile','rs':'Rust','swift':'Swift'};
      const langs: Record<string, number> = {};
      for (const entry of res.data.tree) {
        if (entry.type !== 'blob') continue;
        const path: string = entry.path || '';
        const size: number = Number(entry.size) || 0;
        const ext = path.split('.').pop()?.toLowerCase() || '';
        const lang = mapping[ext];
        if (lang) langs[lang] = (langs[lang] || 0) + size;
      }
      return langs;
    } catch (e: any) {
      this.logger.warn('Failed to infer languages from tree', (e as any)?.message || e);
      return {};
    }
  }

  private parseRepoUrl(repoUrl: string) {
    // support various inputs: full URL, owner/repo, git+url, with/without .git
    if (!repoUrl || typeof repoUrl !== 'string') return null;
    let s = repoUrl.trim();
    // remove git+ prefix
    s = s.replace(/^git\+/, '');
    // remove trailing .git
    if (s.endsWith('.git')) s = s.slice(0, -4);

    // If it looks like a URL but missing slashes (e.g. 'https:/github.com/...'), normalize
    if (/^https?:\/\//i.test(s) === false && /^https?:/i.test(s)) {
      s = s.replace(/^https?:\/*/i, (m) => m.replace(/:\/*/, '://'));
    }

    try {
      if (s.toLowerCase().includes('github.com')) {
        const u = new URL(s.startsWith('http') ? s : `https://${s}`);
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
        return null;
      }

      const parts = s.split('/').filter(Boolean);
      if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
      return null;
    } catch (e: any) {
      return null;
    }
  }

  // Recalculate and return a user's Profile document (points, skills, totals)
  private async recalcProfileForUser(uid: string) {
    const Project = this.mongo.getProjectModel();
    const Profile = this.mongo.getProfileModel();
    // load verified projects (may be none) — use project-stored languages immediately for a quick response
    const projects = await Project.find({ userId: uid, verified: true }).lean();
    const totalPoints = projects.reduce((s:any,p:any)=>s + (p.pointsAwarded || 0), 0);
    const totalContrib = projects.reduce((s:any,p:any)=>s + (p.contributorsCount || 0), 0);
    const totalCommits = projects.reduce((s:any,p:any)=>s + (p.commitsCount || 0), 0);
    const totalPRs = projects.reduce((s:any,p:any)=>s + (p.pullRequestsCount || 0), 0);

    // Compute language scores based on number of repositories using each language
    const repoCountTotals: Record<string, number> = {};
    const repoCount = projects.length || 0;
    for (const pr of projects) {
      const langs = pr.languages || {};
      // count presence of language in a repo (non-zero bytes or present key)
      for (const [k,v] of Object.entries(langs)) {
        const bytes = Number(v) || 0;
        if (bytes > 0 || String(v) === '0' || Object.prototype.hasOwnProperty.call(langs, k)) {
          repoCountTotals[k] = (repoCountTotals[k] || 0) + 1;
        }
      }
    }
    const skills: Record<string, any> = {};
    if (repoCount > 0) {
      for (const [k,v] of Object.entries(repoCountTotals)) {
        const pct = Math.round((Number(v) / repoCount) * 100);
        const lvl = this.computeLevel(pct);
        skills[k] = { percent: pct, level: lvl.level, label: lvl.label, repoCount: v };
      }
    }

    const prof = await Profile.findOneAndUpdate({ userId: uid }, {
      $set: { points: totalPoints, updatedAt: new Date(), skills, contributionCount: totalContrib },
    }, { upsert: true, new: true });
    // also set totals explicitly
    await Profile.findOneAndUpdate({ userId: uid }, { $set: { totalCommits, totalPullRequests: totalPRs } });

    const payload = { userId: uid, profile: prof?.toObject ? prof.toObject() : prof, source: 'recalc' };
    profileEvents.emit('profile.updated', payload);

    // enqueue a background job to compute account-level languages (finer-grained) and update profile asynchronously
    try {
      addLanguageJob(uid);
    } catch (e: any) {
      this.logger.warn('Failed to enqueue language aggregation job', (e as any)?.message || e);
    }

    return prof;
  }

  // Worker-invoked method: perform account-level aggregation and update profile
  async performAccountLanguageAggregation(userId: string) {
    const Project = this.mongo.getProjectModel();
    const Profile = this.mongo.getProfileModel();
    const projects = await Project.find({ userId, verified: true }).lean();
    const totalPoints = projects.reduce((s:any,p:any)=>s + (p.pointsAwarded || 0), 0);
    const totalContrib = projects.reduce((s:any,p:any)=>s + (p.contributorsCount || 0), 0);
    const totalCommits = projects.reduce((s:any,p:any)=>s + (p.commitsCount || 0), 0);
    const totalPRs = projects.reduce((s:any,p:any)=>s + (p.pullRequestsCount || 0), 0);

    const langTotals: Record<string, number> = {};
    const langRepoCounts: Record<string, number> = {};
    let allBytes = 0;

    let reposRes: any = null;
    try {
      const pgUser = await this.prisma.user.findUnique({ where: { id: userId } });
      if (pgUser) {
        let token: string | undefined;
        if (pgUser.githubAccessToken) {
          try { token = decrypt(pgUser.githubAccessToken); } catch (e: any) { this.logger.warn('Failed to decrypt token in worker'); }
        }
        const headers: any = { Accept: 'application/vnd.github.v3+json' };
        if (token) headers.Authorization = `token ${token}`;

        const login = pgUser.username;
        const url = token ? 'https://api.github.com/user/repos?per_page=100&affiliation=owner' : `https://api.github.com/users/${login}/repos?per_page=100`;
        reposRes = await axios.get(url, { headers, validateStatus: ()=>true });
        if (reposRes && reposRes.status === 200 && Array.isArray(reposRes.data)) {
          for (const r of (reposRes.data || []).slice(0, 25)) {
            const owner = r.owner?.login || r.full_name.split('/')[0];
            const name = r.name;
            try {
              const L = await axios.get(`https://api.github.com/repos/${owner}/${name}/languages`, { headers, validateStatus: ()=>true });
              if (L.status === 200 && L.data) {
                let anyLangInRepo = false;
                for (const [k,v] of Object.entries(L.data)) { langTotals[k] = (langTotals[k] || 0) + Number(v || 0); anyLangInRepo = true; langRepoCounts[k] = (langRepoCounts[k] || 0) + 1; }
                continue;
              }
            } catch (e: any) { /* ignore */ }
            try {
              const inferred = await this.inferLanguagesFromTree(owner, name, headers, r.default_branch);
              for (const [k,v] of Object.entries(inferred || {})) { langTotals[k] = (langTotals[k] || 0) + Number(v || 0); langRepoCounts[k] = (langRepoCounts[k] || 0) + 1; }
            } catch (ie: any) { /* ignore */ }
          }
        }
      }
    } catch (e: any) {
      this.logger.warn('Account-level aggregation worker failed', (e as any)?.message || e);
    }

    // debug: log top language totals before fallback
    try {
      this.logger.log(`Account agg - language totals: ${JSON.stringify(langTotals)}`);
      this.logger.log(`Account agg - language repo counts: ${JSON.stringify(langRepoCounts)}`);
    } catch (logErr) { /* ignore */ }

    // if no bytes found, fallback to project languages
    if (Object.values(langTotals).reduce((s:any,v:any)=>s + (Number(v)||0), 0) === 0) {
      for (const pr of projects) {
        const langs = pr.languages || {};
        for (const [k,v] of Object.entries(langs)) {
          const bytes = Number(v) || 0;
          langTotals[k] = (langTotals[k] || 0) + bytes;
          if (!langRepoCounts[k]) langRepoCounts[k] = 0;
          if (bytes > 0 || Object.prototype.hasOwnProperty.call(langs, k)) langRepoCounts[k] = (langRepoCounts[k] || 0) + 1;
          allBytes += bytes;
        }
      }
    } else {
      allBytes = Object.values(langTotals).reduce((s:any,v:any)=>s + (Number(v)||0), 0);
    }

    const skills: Record<string, any> = {};
    // Prefer repo-count based percentages (rule: percent = repoCount / totalRepos)
    const totalRepos = Math.max(1, (reposRes && Array.isArray(reposRes.data) ? (reposRes.data || []).length : projects.length));
    for (const [k,v] of Object.entries(langRepoCounts)) {
      const pct = Math.round((Number(v) / totalRepos) * 100);
      const lvl = this.computeLevel(pct);
      skills[k] = { percent: pct, level: lvl.level, label: lvl.label, repoCount: v };
    }
    // if no repo counts (very rare), fallback to byte-weighted percentages
    if (Object.keys(skills).length === 0 && allBytes > 0) {
      for (const [k,v] of Object.entries(langTotals)) {
        const pct = Math.round((Number(v) / allBytes) * 100);
        const lvl = this.computeLevel(pct);
        skills[k] = { percent: pct, level: lvl.level, label: lvl.label };
      }
    }

    const prof = await Profile.findOneAndUpdate({ userId }, {
      $set: { points: totalPoints, updatedAt: new Date(), skills, contributionCount: totalContrib, totalCommits, totalPullRequests: totalPRs },
    }, { upsert: true, new: true });
    const payload = { userId, profile: prof?.toObject ? prof.toObject() : prof, source: 'language-agg' };
    profileEvents.emit('profile.updated', payload);
    return prof;
  }

  // public wrapper so controllers can trigger recalculation
  // (removed public recompute wrapper) keep internal helper `recalcProfileForUser` only

  async createAndVerify(userId: string, payload: any) {
    const { repoUrl, name, description, readmeUrl, collaborators = [] } = payload;
    const repoParts = this.parseRepoUrl(repoUrl);
    if (!repoParts) throw new Error('Invalid repo url');

    const Project = this.mongo.getProjectModel();
    // Prevent duplicate project entries (match by owner/repo)
    const normalized = `${repoParts.owner}/${repoParts.repo}`.toLowerCase();
    const existing = await Project.findOne({ repoUrl: { $regex: normalized, $options: 'i' } });
    if (existing) {
      throw new Error('Project already exists');
    }

    // find user and decrypt token if available
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    let token: string | undefined;
    if (user?.githubAccessToken) {
      try { token = decrypt(user.githubAccessToken); } catch (e: any) { this.logger.warn('Failed to decrypt token'); }
    }

    const headers: any = { Accept: 'application/vnd.github.v3+json' };
    if (token) headers.Authorization = `token ${token}`;

    const repoApi = `https://api.github.com/repos/${repoParts.owner}/${repoParts.repo}`;
    // fetch repo
    let repoData: any = null;
    try {
      this.logger.log(`Fetching repo: ${repoApi}`);
      const res = await axios.get(repoApi, { headers });
      repoData = res.data;
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      this.logger.warn('Repo fetch failed', status, body);
      if (status === 404) {
        throw new Error(`Repository not found: ${repoParts.owner}/${repoParts.repo}`);
      }
      if (status === 401 || status === 403) {
        throw new Error('Unauthorized to access repository. Ensure user connected GitHub and granted repo access.');
      }
      throw new Error('Repository not found or not accessible');
    }

    // languages
    let languages: Record<string, number> = {};
    try {
      const res = await axios.get(`${repoApi}/languages`, { headers });
      const raw = res.data || {};
      for (const [k,v] of Object.entries(raw)) {
        languages[k] = Number(v) || 0;
      }
    } catch (e: any) { this.logger.warn('Languages fetch failed'); }
    // if languages empty or all zero, try inferring from repo tree
    const totalLangBytes = Object.values(languages).reduce((s:any,v:any)=>s + (Number(v)||0), 0);
    if (totalLangBytes === 0) {
      try {
        const inferred = await this.inferLanguagesFromTree(repoParts.owner, repoParts.repo, headers, repoData?.default_branch);
        if (inferred && Object.keys(inferred).length > 0) languages = inferred;
      } catch (e: any) { /* ignore */ }
    }

    // commits - check at least 1 commit exists
    let commitsExist = false;
    try {
      const res = await axios.get(`${repoApi}/commits?per_page=1`, { headers });
      commitsExist = Array.isArray(res.data) && res.data.length > 0;
    } catch (e: any) { this.logger.warn('Commits fetch failed'); }

    // contributors (public) and collaborators (may require auth)
    let contributorsList: string[] = [];
    let commitsCount = 0;
    try {
      const res = await axios.get(`${repoApi}/contributors?per_page=100`, { headers, validateStatus: ()=>true });
      if (res.status === 200 && Array.isArray(res.data)) {
        contributorsList = (res.data || []).map((c: any) => c.login);
        commitsCount = (res.data || []).reduce((acc:any, cur:any) => acc + (cur.contributions || 0), 0);
      } else {
        this.logger.warn('Contributors fetch failed', res.status, res.data);
      }
    } catch (e: any) { this.logger.warn('Contributors fetch failed', (e as any)?.message || e); }

    // ensure the repo actually belongs to the connected GitHub user
    const submitterLogin = (user?.username || '').toLowerCase();
    const repoOwnerLogin = (repoData?.owner?.login || '').toLowerCase();
    // if the owner doesn't match the submitter, we must reject the submission
    if (repoOwnerLogin !== submitterLogin) {
      // try best-effort collaborator check (public contributors or collaborators API when token present)
      const lowerContribs = contributorsList.map((l) => String(l).toLowerCase());
      let isCollaborator = lowerContribs.includes(submitterLogin);
      if (!isCollaborator && token) {
        try {
          const coll = await axios.get(`${repoApi}/collaborators/${user!.username}`, { headers, validateStatus: ()=>true });
          if (coll.status === 204 || coll.status === 200) isCollaborator = true;
        } catch (err) {
          // ignore collaborator check failure; we'll treat as not collaborator
        }
      }

      if (!isCollaborator) {
        // Reject: the repo is not owned by the connected account and the user is not a collaborator.
        throw new Error(`Repository ownership mismatch: repository ${repoParts.owner}/${repoParts.repo} is owned by "${repoData?.owner?.login}", but your connected GitHub username is "${user?.username}". Please add yourself as a collaborator (or submit a repository you own) and try again.`);
      }
      // If we reach here, the submitter is a confirmed collaborator — but because they are not the owner
      // we still require owner confirmation for a full owner-verified badge. For now, treat as not owner.
      this.logger.log(`User ${user?.username} is a collaborator on ${repoParts.owner}/${repoParts.repo} (not owner).`);
    }

    // match provided collaborators with contributors (only keep confirmed ones)
    const contribSet = new Set(contributorsList.map((l) => String(l).toLowerCase()));
    const confirmed: any[] = collaborators.map((gh:string) => ({ github: gh, confirmed: contribSet.has(String(gh).toLowerCase()) }));
    const invalidCollaborators = confirmed.filter((c:any) => !c.confirmed).map((c:any) => c.github);
    const storedCollaborators = confirmed.filter((c:any) => c.confirmed).map((c:any) => ({ github: c.github }));

    // create project in mongo
    // get pull requests count via search API
    let prCount = 0;
    try {
      const search = await axios.get(`https://api.github.com/search/issues?q=repo:${repoParts.owner}/${repoParts.repo}+type:pr`, { headers, validateStatus: ()=>true });
      if (search.status === 200 && typeof search.data.total_count === 'number') prCount = search.data.total_count;
    } catch (e: any) { this.logger.warn('PR search failed', (e as any)?.message || e); }

    // store canonical repo URL (prefer html_url)
    const canonicalRepoUrl = repoData?.html_url || `https://github.com/${repoParts.owner}/${repoParts.repo}`;

    const project = await Project.create({
      userId,
      repoUrl: canonicalRepoUrl,
      name: name || repoData.name,
      description: description || repoData.description,
      readmeUrl,
      collaborators: storedCollaborators,
      languages,
      verified: true,
      verifiedAt: new Date(),
      pointsAwarded: 100,
      contributorsCount: contributorsList.length,
      commitsCount,
      pullRequestsCount: prCount,
    });
    this.logger.log(`Created project ${project._id} for user ${userId} -> ${project.name}`);

    // update profile stats
    const Profile = this.mongo.getProfileModel();
    // Recalculate profile aggregates for this user (use shared helper)
    const profile = await this.recalcProfileForUser(userId);

    // NOTE: collaborators are recorded only if they are confirmed contributors.
    // We DO NOT duplicate or award points to collaborators here; only the repository owner receives points and profile updates.

    return { project, profile, commitsExist, collaboratorWarnings: invalidCollaborators };
  }

  async listForUser(userId: string) {
    const Project = this.mongo.getProjectModel();
    return Project.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  async getProfileForUser(userId: string) {
    const Profile = this.mongo.getProfileModel();
    return Profile.findOne({ userId }).lean();
  }

  // Aggregate GitHub account-wide metrics (repos, languages, commits by user, PRs)
  async getGithubAggregateForUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const login = user.username;
    let token: string | undefined;
    if (user.githubAccessToken) {
      try { token = decrypt(user.githubAccessToken); } catch (e: any) { this.logger.warn('Failed to decrypt token for aggregate'); }
    }
    const headers: any = { Accept: 'application/vnd.github.v3+json' };
    if (token) headers.Authorization = `token ${token}`;

    // fetch repos for the user (owner)
    let repos: any[] = [];
    let rateLimited = false;
    try {
      // prefer authenticated user repos if token present
      const url = token ? 'https://api.github.com/user/repos?per_page=100&affiliation=owner' : `https://api.github.com/users/${login}/repos?per_page=100`;
      const res = await axios.get(url, { headers, validateStatus: () => true });
      if (res.status === 200 && Array.isArray(res.data)) repos = res.data;
      if (res.status === 403) {
        rateLimited = true;
        this.logger.warn('GitHub repos fetch returned 403 — rate limited for aggregate');
      }
    } catch (e: any) { this.logger.warn('Failed to fetch user repos for aggregate', (e as any)?.message || e); }

    // aggregate languages and commit contributions (approx via contributors list)
    const langTotals: Record<string, number> = {};
    let commitsByUser = 0;
    let totalRepos = repos.length;

    // limit to first 100 repos to avoid long runs
    for (const r of repos) {
      const owner = r.owner?.login || r.full_name.split('/')[0];
      const repo = r.name;
      try {
        const langs = await axios.get(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers, validateStatus: ()=>true });
        if (langs.status === 200 && langs.data) {
          let repoBytes = 0;
          for (const [k,v] of Object.entries(langs.data)) {
            const bytes = Number(v || 0);
            repoBytes += bytes;
            langTotals[k] = (langTotals[k] || 0) + bytes;
          }
          // if GitHub returned empty language bytes, try tree inference for this repo
          if (repoBytes === 0) {
            try {
              const inferred = await this.inferLanguagesFromTree(owner, repo, headers, r.default_branch);
              for (const [k,v] of Object.entries(inferred || {})) {
                langTotals[k] = (langTotals[k] || 0) + Number(v || 0);
              }
            } catch (ie) { /* ignore inference failure */ }
          }
        } else {
          // attempt tree inference if languages endpoint not available
          try {
            const inferred = await this.inferLanguagesFromTree(owner, repo, headers, r.default_branch);
            for (const [k,v] of Object.entries(inferred || {})) {
              langTotals[k] = (langTotals[k] || 0) + Number(v || 0);
            }
          } catch (ie) { /* ignore */ }
        }
      } catch (e: any) { /* ignore per-repo language failures */ }

      try {
        const contrib = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`, { headers, validateStatus: ()=>true });
        if (contrib.status === 200 && Array.isArray(contrib.data)) {
          const me = contrib.data.find((c:any)=>String(c.login).toLowerCase() === String(login).toLowerCase());
          if (me && typeof me.contributions === 'number') commitsByUser += me.contributions;
        }
      } catch (e: any) { /* ignore contributor failures */ }
    }

    // compute languages percentage 0-100 and mastery level
    let allBytes = Object.values(langTotals).reduce((s:any,v:any)=>s + (Number(v)||0), 0);
    const skills: Record<string, any> = {};
    if (allBytes > 0) {
      for (const [k,v] of Object.entries(langTotals)) {
        const pct = Math.round((Number(v)/allBytes)*100);
        const lvl = this.computeLevel(pct);
        skills[k] = { percent: pct, level: lvl.level, label: lvl.label };
      }
    }

    // compute contribution streaks, commits-by-month and daily commits by scanning recent public events
    let currentStreak = 0;
    let longestStreak = 0;
    const commitsByMonthMap: Record<string, number> = {};
    const commitsByDayMap: Record<string, number> = {};
    const prsByMonthMap: Record<string, number> = {};
    const issuesClosedByMonthMap: Record<string, number> = {};
    const forksByMonthMap: Record<string, number> = {};
    try {
      const activityDays = new Set<string>();
      // fetch up to 8 pages of events (~800 events) to better approximate yearly activity
      for (let page = 1; page <= 8; page++) {
        const ev = await axios.get(`https://api.github.com/users/${login}/events/public?per_page=100&page=${page}`, { headers, validateStatus: () => true });
        if (ev.status === 403) {
          rateLimited = true;
          this.logger.warn('GitHub events fetch returned 403 — rate limited when scanning events');
          break;
        }
        if (ev.status !== 200 || !Array.isArray(ev.data)) break;
        for (const e of ev.data) {
          if (!e || !e.created_at) continue;
          const d = new Date(e.created_at);
          const dayKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
          const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; // YYYY-MM

          activityDays.add(dayKey);

          // PushEvent carries commit counts
          if (e.type === 'PushEvent') {
            const commitsInPush = (e.payload && (Array.isArray(e.payload.commits) ? e.payload.commits.length : (typeof e.payload.size === 'number' ? e.payload.size : 0))) || 0;
            commitsByDayMap[dayKey] = (commitsByDayMap[dayKey] || 0) + commitsInPush;
            commitsByMonthMap[monthKey] = (commitsByMonthMap[monthKey] || 0) + commitsInPush;
          }

          // PR events
          if (e.type === 'PullRequestEvent') {
            const action = e.payload?.action;
            if (action === 'opened') {
              prsByMonthMap[monthKey] = (prsByMonthMap[monthKey] || 0) + 1;
            }
          }

          // Issues events - count closed issues as issues solved
          if (e.type === 'IssuesEvent') {
            const action = e.payload?.action;
            if (action === 'closed') {
              issuesClosedByMonthMap[monthKey] = (issuesClosedByMonthMap[monthKey] || 0) + 1;
            }
          }

          // Forks
          if (e.type === 'ForkEvent') {
            forksByMonthMap[monthKey] = (forksByMonthMap[monthKey] || 0) + 1;
          }
        }
        if (ev.data.length < 100) break;
      }

      // compute current streak (consecutive days ending today)
      const today = new Date();
      let dayCursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      while (true) {
        const key = dayCursor.toISOString().slice(0, 10);
        if (activityDays.has(key)) {
          currentStreak++;
          dayCursor.setUTCDate(dayCursor.getUTCDate() - 1);
        } else break;
      }

      // compute longest streak in the collected days (simple scan)
      const sortedDays = Array.from(activityDays).sort();
      let streak = 0;
      let prev: string | null = null;
      for (const d of sortedDays) {
        if (!prev) { streak = 1; prev = d; longestStreak = Math.max(longestStreak, streak); continue; }
        const prevDate = new Date(prev);
        const curDate = new Date(d);
        const diff = Math.round((curDate.getTime() - prevDate.getTime())/ (1000*60*60*24));
        if (diff === 1) { streak++; } else { streak = 1; }
        longestStreak = Math.max(longestStreak, streak);
        prev = d;
      }
    } catch (e: any) {
      this.logger.warn('Failed to compute streaks', (e as any)?.message || e);
    }

    // If we were rate-limited by GitHub, fall back to local Project data to approximate aggregates
    if (rateLimited) {
      try {
        const Project = this.mongo.getProjectModel();
        const stored = await Project.find({ userId }).lean();
        // approximate totals from stored projects
        const approxTotalRepos = stored.length;
        const approxCommits = stored.reduce((s:any,p:any)=>s + (p.commitsCount || 0), 0);
        const approxPRs = stored.reduce((s:any,p:any)=>s + (p.pullRequestsCount || p.prCount || 0), 0);
        // build commitsByMonth by assigning each project's commits to its created month (fallback)
        const commitsByMonthMapFallback: Record<string, number> = {};
        for (const p of stored) {
          const created = p.createdAt ? new Date(p.createdAt) : new Date();
          const key = `${created.getUTCFullYear()}-${String(created.getUTCMonth()+1).padStart(2,'0')}`;
          commitsByMonthMapFallback[key] = (commitsByMonthMapFallback[key] || 0) + (p.commitsCount || 0);
        }
        // build months array
        const now = new Date();
        const monthsFallback: { month:string, label:string, count:number }[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
          monthsFallback.push({ month: key, label: d.toLocaleString('default', { month: 'short', year: 'numeric' }), count: commitsByMonthMapFallback[key] || 0 });
        }

        // build commitsByDay fallback: distribute each repo's commits evenly across the last 90 days (simple heuristic)
        const commitsByDayFallback: { date:string, count:number }[] = [];
        const days = 365;
        const perDay: number[] = new Array(days).fill(0);
        for (const p of stored) {
          const c = p.commitsCount || 0;
          if (c <= 0) continue;
          // spread over last 60 days for newer projects, else 365
          const spread = Math.min(90, Math.max(14, Math.floor(days / Math.max(1, stored.length))));
          for (let i=0;i<c;i++) {
            const idx = Math.floor(Math.random() * spread);
            perDay[days - 1 - idx] += 1;
          }
        }
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
          const key = d.toISOString().slice(0,10);
          commitsByDayFallback.push({ date: key, count: perDay[days - 1 - i] || 0 });
        }

        // build prsByMonth/issuesByMonth from stored data if available
        const prsByMonthFallback = monthsFallback.map(m => ({ month: m.month, label: m.label, count: Math.round(approxPRs / 12) }));
        const issuesByMonthFallback = monthsFallback.map(m => ({ month: m.month, label: m.label, count: 0 }));

        return { totalRepos: approxTotalRepos, commitsByUser: approxCommits, totalPRs: approxPRs, skills, commitsByMonth: monthsFallback, commitsByDay: commitsByDayFallback, prsByMonth: prsByMonthFallback, issuesByMonth: issuesByMonthFallback, forksByMonth: [], totalForks: stored.reduce((s:any,p:any)=>s + (p.forksCount || 0), 0) };
      } catch (fbErr: any) {
        this.logger.warn('Fallback aggregation failed', (fbErr as any)?.message || fbErr);
      }
    }

    // total PRs by search API
    let totalPRs = 0;
    try {
      const search = await axios.get(`https://api.github.com/search/issues?q=author:${login}+type:pr`, { headers, validateStatus: ()=>true });
      if (search.status === 200 && typeof search.data.total_count === 'number') totalPRs = search.data.total_count;
    } catch (e: any) { this.logger.warn('Failed to fetch PR totals', (e as any)?.message || e); }

    // build commitsByMonth array for the last 12 months (including months with 0)
    const now = new Date();
    const months: { month: string, label: string, count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      months.push({ month: key, label: d.toLocaleString('default', { month: 'short', year: 'numeric' }), count: commitsByMonthMap[key] || 0 });
    }

    // build commitsByDay array for last 365 days
    const commitsByDay: { date: string, count: number }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      commitsByDay.push({ date: key, count: commitsByDayMap[key] || 0 });
    }

    // build PRs and issues arrays for last 12 months
    const prsByMonth = months.map(m => ({ month: m.month, label: m.label, count: prsByMonthMap[m.month] || 0 }));
    const issuesByMonth = months.map(m => ({ month: m.month, label: m.label, count: issuesClosedByMonthMap[m.month] || 0 }));
    const forksByMonth = months.map(m => ({ month: m.month, label: m.label, count: forksByMonthMap[m.month] || 0 }));

    // total forks across repositories if available
    let totalForks = 0;
    try { totalForks = repos.reduce((s:any,r:any)=>s + (r.forks_count || 0), 0); } catch(e){}

    return { totalRepos, commitsByUser, totalPRs, skills, commitsByMonth: months, commitsByDay, prsByMonth, issuesByMonth, forksByMonth, totalForks };
  }

  // fetch owner repositories with basic metrics for dashboard (languages, contributors, commits)
  async getUserReposForUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return [];
    const login = user.username;
    let token: string | undefined;
    if (user.githubAccessToken) {
      try { token = decrypt(user.githubAccessToken); } catch (e: any) { this.logger.warn('Failed to decrypt token for repos'); }
    }
    const headers: any = { Accept: 'application/vnd.github.v3+json' };
    if (token) headers.Authorization = `token ${token}`;

    const url = token ? 'https://api.github.com/user/repos?per_page=100&affiliation=owner' : `https://api.github.com/users/${login}/repos?per_page=100`;
    try {
      const res = await axios.get(url, { headers, validateStatus: ()=>true });
      if (res.status !== 200 || !Array.isArray(res.data)) return [];
      const repos = res.data;
      const out: any[] = [];
      for (const r of repos) {
        const owner = r.owner?.login || r.full_name.split('/')[0];
        const name = r.name;
        const full = r.full_name;
        const desc = r.description;
        // languages
        let languages: Record<string, number> = {};
        try {
          const L = await axios.get(`https://api.github.com/repos/${owner}/${name}/languages`, { headers, validateStatus: ()=>true });
          if (L.status === 200 && L.data) {
            for (const [k,v] of Object.entries(L.data)) languages[k] = Number(v) || 0;
          }
        } catch (e: any) { /* ignore */ }
        // fallback to tree inference if languages are empty
        const totalLangBytes = Object.values(languages).reduce((s:any,v:any)=>s + (Number(v)||0), 0);
        if (totalLangBytes === 0) {
          try {
            const inferred = await this.inferLanguagesFromTree(owner, name, headers, r.default_branch);
            if (inferred && Object.keys(inferred).length > 0) languages = inferred;
          } catch (e: any) { /* ignore */ }
        }
        // contributors list, count and commits estimate
        let contributorsCount = 0;
        let commitsCount = 0;
        let contributors: string[] = [];
        try {
          const C = await axios.get(`https://api.github.com/repos/${owner}/${name}/contributors?per_page=100`, { headers, validateStatus: ()=>true });
          if (C.status === 200 && Array.isArray(C.data)) {
            contributorsCount = C.data.length;
            commitsCount = (C.data || []).reduce((s:any,c:any)=>s + (c.contributions || 0), 0);
            contributors = (C.data || []).map((c:any)=>c.login);
          }
        } catch (e: any) { /* ignore */ }
        // PR count
        let prCount = 0;
        try {
          const P = await axios.get(`https://api.github.com/search/issues?q=repo:${owner}/${name}+type:pr`, { headers, validateStatus: ()=>true });
          if (P.status === 200 && typeof P.data.total_count === 'number') prCount = P.data.total_count;
        } catch (e: any) { /* ignore */ }

        out.push({ owner, name, full, description: desc, languages, contributorsCount, commitsCount, contributors, pullRequestsCount: prCount, html_url: r.html_url, private: !!r.private });
      }
      return out;
    } catch (e: any) {
      this.logger.warn('Failed to fetch repos for user', e?.message || e);
      return [];
    }
  }

  // Publish a repository (create a project from an owner repo). repoFullName should be 'owner/repo' or owner and repo provided.
  async publishRepoForUser(userId: string, repoFullName: string, includeCollaborators = false) {
    // normalize incoming repoFullName (can be html_url or owner/repo)
    const parts = this.parseRepoUrl(repoFullName);
    if (!parts) throw new Error('Invalid repo identifier');
    const owner = parts.owner;
    const repo = parts.repo;

    const Project = this.mongo.getProjectModel();
    // try to fetch canonical repo data first
    let repoData: any = null;
    try {
      const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers: { Accept: 'application/vnd.github.v3+json' } });
      repoData = res.data;
    } catch (e: any) {
      // ignore
    }

    const canonical = (repoData && repoData.html_url) ? repoData.html_url : `https://github.com/${owner}/${repo}`;
    // check if project already exists in DB
    const existing = await Project.findOne({ repoUrl: { $regex: `${owner}/${repo}`, $options: 'i' } });
    if (existing) {
      // if existing belongs to same user, return message
      if (String(existing.userId) === String(userId)) {
        const prof = await this.recalcProfileForUser(userId);
        return { message: 'Project already published by you', project: existing, profile: prof };
      }
      // existing belongs to someone else (owner). If current user is a collaborator, reward them but do not duplicate owner's project
      try {
        const contribRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`, { validateStatus: ()=>true });
        if (contribRes.status === 200 && Array.isArray(contribRes.data)) {
          const me = await this.prisma.user.findUnique({ where: { id: userId } });
          const isContributor = contribRes.data.some((c:any) => String(c.login).toLowerCase() === String(me?.username).toLowerCase());
          if (isContributor) {
            // create a project entry for collaborator if not exists
            const collExists = await Project.findOne({ userId, repoUrl: { $regex: `${owner}/${repo}`, $options: 'i' } });
            if (!collExists) {
              // fetch owner project to clone
              const ownerProj = existing.toObject ? existing.toObject() : existing;
              delete ownerProj._id;
              ownerProj.userId = userId;
              ownerProj.pointsAwarded = Math.floor((ownerProj.pointsAwarded || 100)/2);
              await Project.create(ownerProj);
              // recalc profile for the collaborator user and include in response
              const collProfile = await this.recalcProfileForUser(userId);
              return { message: 'Project already added by owner; you were rewarded as a collaborator', project: existing, profile: collProfile };
            }
            // if collExists (already had project) still return current profile
            const collProfile = await this.recalcProfileForUser(userId);
            return { message: 'Project already added by owner; you already had it or were rewarded earlier', project: existing, profile: collProfile };
          }
        }
      } catch (e: any) { /* ignore */ }
      // default: reject publish when owner already added
      throw new Error('Project already published by owner');
    }

    // otherwise proceed to create and verify as owner
    // Build a richer payload using repo metadata so fields (description, readmeUrl, collaborators) are populated
    let readmeUrl: string | undefined = undefined;
    try {
      const R = await axios.get(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers: { Accept: 'application/vnd.github.v3+json' }, validateStatus: ()=>true });
      if (R.status === 200 && R.data?.html_url) readmeUrl = R.data.html_url;
    } catch (e: any) { /* ignore */ }

    // fetch contributors to propose as collaborators
    let contributorUsernames: string[] = [];
    try {
      const contribRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`, { validateStatus: ()=>true });
      if (contribRes.status === 200 && Array.isArray(contribRes.data)) contributorUsernames = contribRes.data.map((c:any)=>c.login);
    } catch (e: any) { /* ignore */ }

    const payload: any = { repoUrl: `${owner}/${repo}`, name: repoData?.name, description: repoData?.description, readmeUrl, collaborators: contributorUsernames };
    const result = await this.createAndVerify(userId, payload);

    // If includeCollaborators is true, duplicate project for confirmed contributors and award them
    if (includeCollaborators && result?.project) {
      const Project = this.mongo.getProjectModel();
      const confirmedCollabs = (result.project.collaborators || []).filter((c:any)=>c.confirmed).map((c:any)=>c.github);
      for (const gh of confirmedCollabs) {
        try {
          // find github user and postgres user
          const u = await axios.get(`https://api.github.com/users/${gh}`, { headers: { Accept: 'application/vnd.github.v3+json' }, validateStatus: ()=>true });
          if (u.status !== 200) continue;
          const githubId = String(u.data.id);
          const pg = await this.prisma.user.findUnique({ where: { githubId } });
          if (!pg) continue;
          // check if collaborator already has this project
          const exists = await Project.findOne({ userId: pg.id, repoUrl: result.project.repoUrl });
          if (exists) continue;
          const obj = result.project.toObject ? result.project.toObject() : result.project;
          delete obj._id;
          obj.userId = pg.id;
          // give collaborator half points
          obj.pointsAwarded = Math.floor((obj.pointsAwarded || 100) / 2);
          await Project.create(obj);
          // recalc collaborator profile
          await this.recalcProfileForUser(pg.id);
        } catch (e: any) {
          this.logger.warn('Failed to add collaborator project', gh, (e as any)?.message || e);
        }
      }
    }

    // return the created project + owner profile (createAndVerify already recalculated owner's profile)
    return result;
  }

  // Unpublish (remove) a project created earlier by user
  async unpublishRepoForUser(userId: string, repoFullName: string) {
    const Project = this.mongo.getProjectModel();
    // match by owner/repo in repoUrl or full_name
    const normalized = repoFullName.toLowerCase();
    const res = await Project.deleteMany({ userId, repoUrl: { $regex: normalized, $options: 'i' } });
    // recalc profile after deletion
    const profile = await this.recalcProfileForUser(userId);
    return { deletedCount: res.deletedCount || 0, profile };
  }

  async getPublicProfileByUsername(username: string) {
    // find postgres user by username
    const pg = await this.prisma.user.findUnique({ where: { username } });
    if (!pg) return null;
    const Profile = this.mongo.getProfileModel();
    const Project = this.mongo.getProjectModel();
    const profile = await Profile.findOne({ userId: pg.id }).lean();
    const projects = await Project.find({ userId: pg.id, verified: true }).sort({ createdAt: -1 }).lean();
    return { user: { id: pg.id, username: pg.username, fullName: pg.fullName, avatarUrl: pg.avatarUrl }, profile, projects };
  }
}
