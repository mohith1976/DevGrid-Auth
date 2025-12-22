import { Injectable, Logger } from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';
import { PrismaService } from '../prisma.service';
import { profileEvents } from '../events/profile-events';
import axios from 'axios';
import { decrypt } from '../utils/crypto.util';

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);
  constructor(private mongo: MongoService, private prisma: PrismaService) {}

  async createProposal(ownerId: string, payload: any) {
    const Proposal = this.mongo.getProposalModel();
    const Project = this.mongo.getProjectModel();
    // validate required fields
    if (!payload || !payload.title || !payload.description || !payload.repoUrl || !payload.requirements || !payload.requirements.languages) {
      throw new Error('Missing required fields: title, description, repoUrl, languages');
    }

    const doc: any = {
      ownerId,
      title: payload.title,
      repoUrl: payload.repoUrl,
      description: payload.description || '',
      teamSize: Math.max(1, Math.min(5, Number(payload.teamSize) || 3)),
      // normalize requirement names: accept minContributions from frontend
      requirements: Object.assign({}, payload.requirements || {}, {
        // keep legacy field in sync for older codepaths
        minCommits: Number((payload.requirements && (payload.requirements.minContributions ?? payload.requirements.minCommits)) || 0),
        minContributions: Number((payload.requirements && (payload.requirements.minContributions ?? payload.requirements.minCommits)) || 0)
      }),
      // reward is fixed to 100 points; awarded on completion
      rewardPoints: 100,
      tags: payload.tags || [],
    };
    // Normalize title and repoUrl for comparison and storage (trim and lower-case repo URL)
    const titleNorm = (doc.title || '').trim();
    const repoNorm = (doc.repoUrl || '').trim().toLowerCase();
    // persist normalized values to avoid variations causing duplicates
    doc.title = titleNorm;
    doc.repoUrl = repoNorm;

    // verify repoUrl looks valid and belongs to the creating user
    function extractRepoPath(url: string) {
      if (!url) return null;
      // remove protocol and trailing .git and trailing slash
      let u = url.replace(/^https?:\/\//i, '').replace(/^git@/, '').replace(/\.git$/i, '').replace(/:\/\//, '').replace(/\/$/, '');
      // github.com/owner/repo or git@github.com:owner/repo
      const m = u.match(/github\.com[:\/]?([^\/]+\/[^\/]+)(?:\/.*)?$/i);
      if (m && m[1]) return m[1].toLowerCase();
      // fallback: if path-like string provided, try to use it
      const p = u.split('/').slice(-2).join('/');
      return p ? p.toLowerCase() : null;
    }

    const repoPath = extractRepoPath(repoNorm);
    if (!repoPath) throw new Error('Invalid repository URL');

    // Verify repository exists on GitHub and that the creating user is the owner or a confirmed collaborator.
    try {
      const pgUser = await this.prisma.user.findUnique({ where: { id: ownerId } });
      let token: string | undefined;
      if (pgUser?.githubAccessToken) {
        try { token = decrypt(pgUser.githubAccessToken); } catch (e:any) { this.logger.warn('Failed to decrypt github token for proposals'); }
      }
      const headers: any = { Accept: 'application/vnd.github.v3+json' };
      if (token) headers.Authorization = `token ${token}`;

      const [ownerFromUrl, repoFromUrl] = repoPath.split('/');
      const repoApi = `https://api.github.com/repos/${ownerFromUrl}/${repoFromUrl}`;
      let repoData: any = null;
      try {
        const res = await axios.get(repoApi, { headers, validateStatus: () => true });
        if (res.status !== 200 || !res.data) {
          if (res.status === 404) throw new Error(`Repository not found: ${repoPath}`);
          if (res.status === 401 || res.status === 403) throw new Error('Unauthorized to access repository. Ensure user connected GitHub and granted repo access.');
          throw new Error('Repository not accessible');
        }
        repoData = res.data;
      } catch (e:any) {
        const status = e?.response?.status;
        if (status === 404) throw new Error(`Repository not found: ${repoPath}`);
        throw e;
      }

      const repoOwnerLogin = (repoData.owner?.login || '').toLowerCase();
      const submitterLogin = (pgUser?.username || '').toLowerCase();

      if (repoOwnerLogin !== submitterLogin) {
        // try public contributors list first
        let isCollaborator = false;
        try {
          const contribRes = await axios.get(`${repoApi}/contributors?per_page=100`, { headers, validateStatus: () => true });
          if (contribRes.status === 200 && Array.isArray(contribRes.data)) {
            const lowerContribs = contribRes.data.map((c:any) => String(c.login).toLowerCase());
            if (lowerContribs.includes(submitterLogin)) isCollaborator = true;
          }
        } catch (e) {
          // ignore contributor lookup errors
        }

        // if token available, check collaborators endpoint for definitive answer
        if (!isCollaborator && token && pgUser?.username) {
          try {
            const coll = await axios.get(`${repoApi}/collaborators/${pgUser.username}`, { headers, validateStatus: () => true });
            if (coll.status === 204 || coll.status === 200) isCollaborator = true;
          } catch (e) {
            // ignore collaborator check failures
          }
        }

        if (!isCollaborator) {
          throw new Error(`Repository ownership mismatch: repository ${repoPath} is owned by "${repoOwnerLogin}", but your connected GitHub username is "${submitterLogin}". Please add yourself as a collaborator (or submit a repository you own) and try again.`);
        }
        this.logger.log(`User ${submitterLogin} is a collaborator on ${repoPath} (not owner).`);
      }
    } catch (e:any) {
      throw e;
    }
    // use case-insensitive exact-match check to find existing proposals even if stored casing differs
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const titleRe = new RegExp(`^${esc(titleNorm)}$`, 'i');
    const repoRe = new RegExp(`^${esc(repoNorm)}$`, 'i');
    // Check if an OPEN proposal already exists for the same title OR repoUrl
    const existing = await Proposal.findOne({ status: 'open', $or: [{ title: titleRe }, { repoUrl: repoRe }] }).lean();
    if (existing) throw new Error('A proposal with the same title or repository URL already exists and is currently open');

    try {
      const created = await Proposal.create(doc);
      return created.toObject ? created.toObject() : created;
    } catch (e:any) {
      // handle duplicate key race (unique index) gracefully
      if (e && e.code === 11000) throw new Error('A proposal with the same title and repository URL already exists');
      throw e;
    }
  }

  async listProposals(query: any = {}) {
    const Proposal = this.mongo.getProposalModel();
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.tag) filter.tags = query.tag;
    // simple text search
    if (query.q) filter.$or = [ { title: new RegExp(query.q, 'i') }, { description: new RegExp(query.q, 'i') } ];
    const res = await Proposal.find(filter).sort({ createdAt: -1 }).lean();
    return res;
  }

  async getProposalById(id: string) {
    const Proposal = this.mongo.getProposalModel();
    return Proposal.findById(id).lean();
  }

  // return owner's proposals including applicants (owner-only)
  async getOwnerProposalsWithApplicants(ownerId: string) {
    const Proposal = this.mongo.getProposalModel();
    const Profile = this.mongo.getProfileModel();
    const res: any[] = await Proposal.find({ ownerId }).sort({ createdAt: -1 }).lean();
    // collect unique applicant userIds to batch lookup
    const userIdSet = new Set<string>();
    for (const p of res) {
      if (p.applicants && Array.isArray(p.applicants)) {
        for (const a of p.applicants) if (a && a.userId) userIdSet.add(String(a.userId));
      }
    }
    const userIds = Array.from(userIdSet);
    const userMap: Record<string, any> = {};
    try {
      if (userIds.length > 0 && (this.prisma && (this.prisma as any).user)) {
        const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, githubId: true } });
        for (const u of users) userMap[String(u.id)] = u;
      }
    } catch (e) {
      // ignore prisma lookup errors
    }

    // enrich applicants with profile (mongo) and username (prisma) when available
    for (const p of res) {
      if (p.applicants && Array.isArray(p.applicants) && p.applicants.length > 0) {
        for (const a of p.applicants) {
          try {
            const prof = await Profile.findOne({ userId: String(a.userId) }).lean() as any;
            if (prof) {
              a.profile = { points: prof.points || 0, level: prof.level || 0, totalCommits: prof.totalCommits || 0 };
            } else {
              a.profile = null;
            }
          } catch (e) {
            a.profile = null;
          }
          const pg = userMap[String(a.userId)];
          a.username = pg ? (pg.username || null) : null;
          if (pg) {
            if (pg.githubId) {
              a.avatarUrl = `https://avatars.githubusercontent.com/u/${pg.githubId}?s=80&v=4`;
            } else if (pg.username) {
              a.avatarUrl = `https://github.com/${pg.username}.png?size=80`;
            }
          }
        }
      }
    }

    return res;
  }

  // return applications made by a user across proposals
  async getUserApplications(userId: string) {
    const Proposal = this.mongo.getProposalModel();
    const docs = await Proposal.find({ 'applicants.userId': userId }).lean();
    // map to application entries with proposal meta
    const apps: any[] = [];
    for (const p of docs) {
      const list = (p.applicants || []).filter((a:any)=>String(a.userId) === String(userId));
      for (const a of list) {
        apps.push({ proposalId: p._id, title: p.title, repoUrl: p.repoUrl, status: a.status, reason: a.reason, appliedAt: a.createdAt, deletedAt: a.deletedAt });
      }
    }
    return apps;
  }

  // cleanup applications older than `days` (default 12 days)
  async cleanupOldApplications(days = 12) {
    const Proposal = this.mongo.getProposalModel();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const threeDayCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // 1) Remove rejected applicants older than 3 days and notify them of deletion
    const withRejected = await Proposal.find({ 'applicants.rejectedAt': { $lt: threeDayCutoff } }).lean();
    let removedCount = 0;
    for (const p of withRejected) {
      try {
        const toRemove = (p.applicants || []).filter((a:any)=> a && a.status === 'rejected' && a.rejectedAt && (new Date(a.rejectedAt) < threeDayCutoff));
        if (toRemove.length === 0) continue;
        // remove them from the live document and save
        const live = await Proposal.findById(p._id) as any;
        if (!live) continue;
        for (const a of toRemove) {
          live.applicants = (live.applicants || []).filter((x:any)=> String(x.userId) !== String(a.userId) || x.rejectedAt === undefined || new Date(x.rejectedAt) >= threeDayCutoff);
          removedCount++;
          // notify applicant that their rejected application entry was removed
          try { profileEvents.emit('profile.updated', { userId: a.userId, event: 'proposal.application.deleted', proposalId: p._id }); } catch(e){}
        }
        await live.save();
      } catch (e:any) { this.logger.warn('Failed to remove rejected applicants', e?.message || e); }
    }

    // 2) Remove applicants older than general cutoff (legacy behavior)
    const res = await Proposal.updateMany({ 'applicants.createdAt': { $lt: cutoff } }, { $pull: { applicants: { createdAt: { $lt: cutoff } } } });
    return { legacyRemoved: res, rejectedRemoved: removedCount };
  }

  // cleanup proposals that are open with no applicants older than `days` (default 14)
  async cleanupStaleProposals(days = 14) {
    const Proposal = this.mongo.getProposalModel();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const stale = await Proposal.find({ status: 'open', applicants: { $size: 0 }, createdAt: { $lt: cutoff } }).lean();
    for (const p of stale) {
      try {
        await Proposal.deleteOne({ _id: p._id });
        // notify owner that their proposal was removed as stale
        profileEvents.emit('profile.updated', { userId: p.ownerId, event: 'proposal.stale.deleted', proposalId: p._id });
      } catch (e: any) {
        this.logger.warn('Failed to delete stale proposal', (e as any)?.message || e);
      }
    }
    return { deleted: stale.length };
  }

  // validate applicant meets requirements
  // NOTE: This variant uses only the applicant's GitHub account to compute
  // repoCount, totalContributions and language matches. It ignores any local
  // DB `projects` or `profile` values to avoid stale/missing data causing
  // auto-rejection.
  private async validateApplicantRequirements(userId: string, requirements: any) {
    let repoCount = 0;
    let totalContributions = 0;
    let level = 0;

    try {
      const pgUser = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!pgUser || !pgUser.username) {
        this.logger.debug('Applicant has no linked GitHub username; failing requirements by default');
        // proceed with zeros (will likely fail requirements)
      } else {
        const login = pgUser.username;
        let token: string | undefined;
        if (pgUser.githubAccessToken) {
          try { token = decrypt(pgUser.githubAccessToken); } catch (e:any) { this.logger.warn('Failed to decrypt token for applicant validation'); }
        }
        const headers: any = { Accept: 'application/vnd.github.v3+json' };
        if (token) headers.Authorization = `token ${token}`;

        try {
          const url = token ? 'https://api.github.com/user/repos?per_page=100&affiliation=owner' : `https://api.github.com/users/${login}/repos?per_page=100&type=owner`;
          const reposRes = await axios.get(url, { headers, validateStatus: () => true });
          if (reposRes && reposRes.status === 200 && Array.isArray(reposRes.data)) {
            const repos = reposRes.data.slice(0, 100);
            repoCount = repos.length;

            // compute contributions: best-effort by summing per-repo contributor entry
            let contribSum = 0;
            for (const r of repos) {
              try {
                // attempt to get contributors list; many repos will allow public access
                const owner = r.owner?.login || login;
                const name = r.name;
                const contribRes = await axios.get(`https://api.github.com/repos/${owner}/${name}/contributors?per_page=100`, { headers, validateStatus: () => true });
                if (contribRes && contribRes.status === 200 && Array.isArray(contribRes.data)) {
                  const me = contribRes.data.find((c:any) => String(c.login).toLowerCase() === String(login).toLowerCase());
                  if (me && typeof me.contributions === 'number') contribSum += me.contributions;
                }
              } catch (e) {
                // ignore per-repo failures
              }
            }
            totalContributions = contribSum;

            // language match: use repo.language (primary) as a lightweight check
            // we'll count repos whose primary language matches any required language
          }
        } catch (e:any) {
          this.logger.warn('Failed to fetch GitHub repos for applicant validation', (e as any)?.message || e);
        }
      }
    } catch (e:any) {
      this.logger.warn('Applicant GitHub-only validation failed', (e as any)?.message || e);
    }

    // languages requirement: we cannot rely on local project language maps anymore.
    // We'll re-fetch the repo list (lightweight) and check the `language` field
    // for each repo to count matching languages.
    let langMatchCount = 0;
    if (requirements?.languages && Array.isArray(requirements.languages) && requirements.languages.length > 0) {
      try {
        const pgUser = await this.prisma.user.findUnique({ where: { id: userId } });
        if (pgUser && pgUser.username) {
          const login = pgUser.username;
          let token: string | undefined;
          if (pgUser.githubAccessToken) {
            try { token = decrypt(pgUser.githubAccessToken); } catch (e:any) { /* ignore */ }
          }
          const headers: any = { Accept: 'application/vnd.github.v3+json' };
          if (token) headers.Authorization = `token ${token}`;
          const url = token ? 'https://api.github.com/user/repos?per_page=100&affiliation=owner' : `https://api.github.com/users/${login}/repos?per_page=100&type=owner`;
          const reposRes = await axios.get(url, { headers, validateStatus: () => true });
          if (reposRes && reposRes.status === 200 && Array.isArray(reposRes.data)) {
            const repos = reposRes.data.slice(0, 100);
            for (const r of repos) {
              const primary = (r.language || '') ? String(r.language).toLowerCase() : '';
              for (const L of requirements.languages) {
                if (primary && primary === String(L).toLowerCase()) { langMatchCount++; break; }
              }
            }
          }
        }
      } catch (e:any) {
        this.logger.warn('Failed to compute language matches from GitHub', (e as any)?.message || e);
      }
    }

    const meetsRepoCount = !requirements?.minRepoCount || repoCount >= Number(requirements.minRepoCount || 0);
    const minContribReq = Number(requirements?.minContributions ?? requirements?.minCommits ?? 0);
    const meetsContributions = !minContribReq || totalContributions >= minContribReq;
    const meetsLevel = !requirements?.minLevel || level >= Number(requirements.minLevel || 0);
    const meetsLangs = !(requirements?.languages && requirements.languages.length > 0) || langMatchCount >= 1;

    this.logger.debug(`Applicant GitHub-only validation: repoCount=${repoCount}, totalContributions=${totalContributions}, langMatchCount=${langMatchCount}`);

    return {
      meetsAll: meetsRepoCount && meetsContributions && meetsLevel && meetsLangs,
      meetsCore: meetsRepoCount && meetsContributions && meetsLevel,
      meetsRepoCount,
      meetsContributions,
      meetsLevel,
      meetsLangs,
      details: { repoCount, totalContributions, level, langMatchCount }
    };
  }

  async applyToProposal(userId: string, proposalId: string, message?: string) {
    const Proposal = this.mongo.getProposalModel();
    const p = await Proposal.findById(proposalId) as any;
    if (!p) throw new Error('Proposal not found');
    if (p.status !== 'open') throw new Error('Proposal is not open for applications');
    // owners cannot apply to their own proposals
    if (String(p.ownerId) === String(userId)) throw new Error('Owner cannot apply to own proposal');
    p.applicants = p.applicants || [];
    p.members = p.members || [];
    const existing = (p.applicants || []).find((a:any)=>String(a.userId) === String(userId));
    if (existing) {
      if (existing.status === 'pending') throw new Error('Already applied (pending)');
      if (existing.status === 'accepted' || (p.members || []).some((m:any)=>String(m.userId) === String(userId))) throw new Error('Already a member');
      if (existing.status === 'rejected') {
        // allow reapply only if rejection is older than 3 days
        const rejectedAt = existing.rejectedAt ? new Date(existing.rejectedAt) : null;
        if (rejectedAt) {
          const ageMs = Date.now() - rejectedAt.getTime();
          const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
          if (ageMs > threeDaysMs) {
            // remove the old rejected entry so a fresh application can be created
            p.applicants = p.applicants.filter((a:any)=>String(a.userId) !== String(userId));
          } else {
            throw new Error('Application was rejected previously');
          }
        } else {
          throw new Error('Application was rejected previously');
        }
      }
      // allow re-apply if previous status was withdrawn (we will remove entries on withdraw)
    }
    // check if already member
    if ((p.members || []).some((m:any)=>String(m.userId) === String(userId))) throw new Error('Already a member');

    const validation = await this.validateApplicantRequirements(userId, p.requirements || {});

    p.applicants = p.applicants || [];

    // Auto-reject when core numeric requirements (min contributions or min level or min repos) are not met.
    if (!validation.meetsCore) {
      const reasonParts: string[] = [];
      if (!validation.meetsRepoCount) reasonParts.push('minRepoCount');
      if (!validation.meetsContributions) reasonParts.push('minContributions');
      if (!validation.meetsLevel) reasonParts.push('minLevel');
      const reason = `Auto-rejected: does not meet ${reasonParts.join(', ')}`;

      // Do NOT insert auto-rejected applicants into the proposal applicants list (owners should not see them).
      // Notify the applicant only.
      profileEvents.emit('profile.updated', { userId, event: 'proposal.application.auto_rejected', proposalId, reason });
      return { success: true, status: 'rejected', reason };
    }

    // Otherwise allow application (even if language match is low); owner will review languages
    p.applicants.push({ userId, message: message || '', status: 'pending', createdAt: new Date() });
    await p.save();

    // notify owner via profileEvents (owner will receive SSE if connected)
    profileEvents.emit('profile.updated', { userId: p.ownerId, event: 'proposal.application', proposalId, applicantId: userId });
    return { success: true, status: 'pending' };
  }

  async listApplicants(ownerId: string, proposalId: string) {
    const Proposal = this.mongo.getProposalModel();
    const p = await Proposal.findById(proposalId).lean() as any;
    if (!p) throw new Error('Proposal not found');
    if (String(p.ownerId) !== String(ownerId)) throw new Error('Not authorized');
    return p.applicants || [];
  }

  async acceptApplicant(ownerId: string, proposalId: string, applicantId: string) {
    const Proposal = this.mongo.getProposalModel();
    const Profile = this.mongo.getProfileModel();
    const p: any = await Proposal.findById(proposalId) as any;
    if (!p) throw new Error('Proposal not found');
    if (String(p.ownerId) !== String(ownerId)) throw new Error('Not authorized');
    if (p.status !== 'open') throw new Error('Proposal not open');

    // quick pre-checks
    p.applicants = p.applicants || [];
    p.members = p.members || [];
    const idx = p.applicants.findIndex((a:any)=>String(a.userId) === String(applicantId));
    if (idx === -1) throw new Error('Applicant not found');
    if ((p.members || []).some((m:any)=>String(m.userId) === String(applicantId))) throw new Error('Applicant already a member');
    if ((p.members || []).length >= p.teamSize) throw new Error('Team is full');

    // perform an atomic update: add member only if not already a member and team not full and applicant still present
    const updated = await Proposal.findOneAndUpdate(
      { _id: proposalId, ownerId: ownerId, status: 'open', 'members.userId': { $ne: applicantId }, 'applicants.userId': applicantId, $expr: { $lt: [ { $size: '$members' }, '$teamSize' ] } },
      { $push: { members: { userId: applicantId, joinedAt: new Date() } }, $set: { 'applicants.$.status': 'accepted' } },
      { new: true }
    ) as any;

    if (!updated) {
      // determine reason
      const fresh = await Proposal.findById(proposalId) as any;
      if (!fresh) throw new Error('Proposal not found');
      if ((fresh.members || []).some((m:any)=>String(m.userId) === String(applicantId))) throw new Error('Applicant already a member');
      if ((fresh.members || []).length >= fresh.teamSize) throw new Error('Team is full');
      const idx2 = (fresh.applicants || []).findIndex((a:any)=>String(a.userId) === String(applicantId));
      if (idx2 === -1) throw new Error('Applicant not found');
      throw new Error('Unable to accept applicant');
    }

    // if team reached capacity after acceptance, mark in-progress
    if ((updated.members || []).length >= updated.teamSize && updated.status !== 'in-progress') {
      updated.status = 'in-progress';
      await updated.save();
    }

    // create or update Team for this proposal: if not exists, create and add owner + members
    let resultTeamId: string | null = null;
    try {
      const Team = this.mongo.getTeamModel();
      let teamId = updated.teamId || p.teamId || null;
      if (!teamId) {
        // build members: ensure owner present as leader
        const members = [] as any[];
        members.push({ userId: updated.ownerId || ownerId, joinedAt: new Date(), role: 'leader' });
        // add all current members from proposal (including newly accepted)
        for (const m of (updated.members || [])) {
          // avoid duplicate owner entry
          if (String(m.userId) === String(ownerId)) continue;
          members.push({ userId: m.userId, joinedAt: m.joinedAt || new Date(), role: 'member' });
        }
        const createdTeam = await Team.create({ proposalId: proposalId, name: `${(updated.title || 'Project')} Team`, ownerId: ownerId, members, meta: { createdBy: ownerId } });
        teamId = String(createdTeam._id);
        resultTeamId = teamId;
        // persist teamId on proposal
        updated.teamId = teamId;
        await updated.save();
        profileEvents.emit('profile.updated', { userId: ownerId, event: 'team.created', proposalId, teamId });
        // notify all members that they've been added to a team
        for (const m of members) {
          try { profileEvents.emit('profile.updated', { userId: m.userId, event: 'team.member.added', proposalId, teamId }); } catch (e) {}
        }
      } else {
        // add applicant to existing team if not present
        const team = await Team.findById(teamId) as any;
        if (team) {
          const already = (team.members || []).some((mm:any)=>String(mm.userId) === String(applicantId));
          if (!already) {
            team.members = team.members || [];
            team.members.push({ userId: applicantId, joinedAt: new Date(), role: 'member' });
            await team.save();
            profileEvents.emit('profile.updated', { userId: applicantId, event: 'team.member.added', proposalId, teamId });
            resultTeamId = teamId;
          }
        }
      }
    } catch (e:any) {
      this.logger.warn('Failed to create/add to team on accept', e?.message || e);
    }

    // notify applicant
    profileEvents.emit('profile.updated', { userId: applicantId, event: 'proposal.accepted', proposalId });
    return { success: true, teamId: resultTeamId };
  }

  async rejectApplicant(ownerId: string, proposalId: string, applicantId: string, reason?: string) {
    const Proposal = this.mongo.getProposalModel();
    const p: any = await Proposal.findById(proposalId) as any;
    if (!p) throw new Error('Proposal not found');
    if (String(p.ownerId) !== String(ownerId)) throw new Error('Not authorized');
    p.applicants = p.applicants || [];
    const idx = p.applicants.findIndex((a:any)=>String(a.userId) === String(applicantId));
    if (idx === -1) throw new Error('Applicant not found');

    const reasonText = reason || 'rejected by owner';
    const now = new Date();
    const deleteAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    // mark the applicant as rejected and schedule deletion
    p.applicants[idx].status = 'rejected';
    p.applicants[idx].reason = reasonText;
    p.applicants[idx].rejectedAt = now;
    p.applicants[idx].deletedAt = deleteAt;
    p.applicants[idx].updatedAt = now;
    await p.save();

    // notify applicant that their application was rejected and scheduled for deletion
    profileEvents.emit('profile.updated', { userId: applicantId, event: 'proposal.rejected', proposalId, reason: reasonText, deletedAt: deleteAt });
    // also notify owner profile that rejection processed
    profileEvents.emit('profile.updated', { userId: ownerId, event: 'proposal.applicant.rejected', proposalId, applicantId, reason: reasonText });
    return { success: true, deletedAt: deleteAt };
  }

  // allow applicant to withdraw their pending application within 7 days
  async withdrawApplication(userId: string, proposalId: string) {
    const Proposal = this.mongo.getProposalModel();
    const p: any = await Proposal.findById(proposalId) as any;
    if (!p) throw new Error('Proposal not found');
    p.applicants = p.applicants || [];
    const idx = p.applicants.findIndex((a:any)=>String(a.userId) === String(userId));
    if (idx === -1) throw new Error('Application not found');
    const applicant = p.applicants[idx];
    if (applicant.status !== 'pending') throw new Error('Only pending applications can be withdrawn');
    const created = new Date(applicant.createdAt || applicant.createdAt);
    const ageMs = Date.now() - created.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (ageMs > sevenDaysMs) throw new Error('Cannot withdraw application after 7 days');

    // remove applicant entry so they can re-apply later if desired
    p.applicants.splice(idx, 1);
    await p.save();

    profileEvents.emit('profile.updated', { userId, event: 'proposal.withdrawn', proposalId });
    return { success: true };
  }

  async completeProposal(ownerId: string, proposalId: string) {
    const Proposal = this.mongo.getProposalModel();
    const Profile = this.mongo.getProfileModel();
    const p: any = await Proposal.findById(proposalId) as any;
    if (!p) throw new Error('Proposal not found');
    if (String(p.ownerId) !== String(ownerId)) throw new Error('Not authorized');
    if (p.status !== 'in-progress') throw new Error('Project not in progress');

    p.status = 'completed';
    await p.save();

    // distribute rewards using existing points mechanism: add points into Profile.points for members
    const members = p.members || [];
    const totalReward = Number(p.rewardPoints || 0);
    const perMember = members.length > 0 ? Math.round(totalReward / members.length) : 0;
    for (const m of members) {
      await Profile.findOneAndUpdate({ userId: m.userId }, { $inc: { points: perMember } }, { upsert: true });
      profileEvents.emit('profile.updated', { userId: m.userId, event: 'proposal.completed', proposalId });
    }

    return { success: true, distributed: perMember };
  }

}
