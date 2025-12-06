import { Injectable, Logger } from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';
import { PrismaService } from '../prisma.service';
import { profileEvents } from '../events/profile-events';

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);
  constructor(private mongo: MongoService, private prisma: PrismaService) {}

  async createProposal(ownerId: string, payload: any) {
    const Proposal = this.mongo.getProposalModel();
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
      requirements: payload.requirements || {},
      // reward is fixed to 100 points; awarded on completion
      rewardPoints: 100,
      tags: payload.tags || [],
    };
    const created = await Proposal.create(doc);
    return created.toObject ? created.toObject() : created;
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

  // validate applicant meets requirements
  private async validateApplicantRequirements(userId: string, requirements: any) {
    const Project = this.mongo.getProjectModel();
    const Profile = this.mongo.getProfileModel();
    const profile = await Profile.findOne({ userId }).lean() as any;
    const projects = await Project.find({ userId, verified: true }).lean() as any[];

    const repoCount = projects.length;
    const totalCommits = profile?.totalCommits || projects.reduce((s:any,p:any)=>s + (p.commitsCount || 0), 0);
    const level = profile?.level || 0;

    // languages requirement: check number of repos matching required languages
    let langMatchCount = 0;
    if (requirements?.languages && Array.isArray(requirements.languages) && requirements.languages.length > 0) {
      for (const p of projects) {
        const langs = p.languages || {};
        for (const L of requirements.languages) {
          if (Object.prototype.hasOwnProperty.call(langs, L) && (Number(langs[L] || 0) > 0)) { langMatchCount++; break; }
        }
      }
    }

    const meetsRepoCount = !requirements?.minRepoCount || repoCount >= Number(requirements.minRepoCount || 0);
    const meetsCommits = !requirements?.minCommits || totalCommits >= Number(requirements.minCommits || 0);
    const meetsLevel = !requirements?.minLevel || level >= Number(requirements.minLevel || 0);
    const meetsLangs = !(requirements?.languages && requirements.languages.length > 0) || langMatchCount >= 1;

    return {
      meetsAll: meetsRepoCount && meetsCommits && meetsLevel && meetsLangs,
      meetsCore: meetsRepoCount && meetsCommits && meetsLevel,
      meetsRepoCount,
      meetsCommits,
      meetsLevel,
      meetsLangs,
      details: { repoCount, totalCommits, level, langMatchCount }
    };
  }

  async applyToProposal(userId: string, proposalId: string, message?: string) {
    const Proposal = this.mongo.getProposalModel();
    const p = await Proposal.findById(proposalId) as any;
    if (!p) throw new Error('Proposal not found');
    if (p.status !== 'open') throw new Error('Proposal is not open for applications');
    // check already applied
    if ((p.applicants || []).some((a:any)=>String(a.userId) === String(userId))) throw new Error('Already applied');
    // check if already member
    if ((p.members || []).some((m:any)=>String(m.userId) === String(userId))) throw new Error('Already a member');

    const validation = await this.validateApplicantRequirements(userId, p.requirements || {});

    p.applicants = p.applicants || [];

    // Auto-reject when core numeric requirements (min commits or min level or min repos) are not met.
    if (!validation.meetsCore) {
      const reasonParts: string[] = [];
      if (!validation.meetsRepoCount) reasonParts.push('minRepoCount');
      if (!validation.meetsCommits) reasonParts.push('minCommits');
      if (!validation.meetsLevel) reasonParts.push('minLevel');
      const reason = `Auto-rejected: does not meet ${reasonParts.join(', ')}`;
      p.applicants.push({ userId, message: message || '', status: 'rejected', reason, createdAt: new Date() });
      await p.save();

      // notify owner and applicant
      profileEvents.emit('profile.updated', { userId: p.ownerId, event: 'proposal.application.rejected', proposalId, applicantId: userId, reason });
      profileEvents.emit('profile.updated', { userId, event: 'proposal.application.rejected', proposalId, reason });
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

    p.applicants = p.applicants || [];
    const idx = p.applicants.findIndex((a:any)=>String(a.userId) === String(applicantId));
    if (idx === -1) throw new Error('Applicant not found');

    p.members = p.members || [];
    if (p.members.length >= p.teamSize) throw new Error('Team is full');

    // accept
    p.members.push({ userId: applicantId, joinedAt: new Date() });
    p.applicants[idx].status = 'accepted';
    await p.save();

    // change status to in-progress when full
    if (p.members.length >= p.teamSize) {
      p.status = 'in-progress';
      await p.save();
    }

    // notify applicant
    profileEvents.emit('profile.updated', { userId: applicantId, event: 'proposal.accepted', proposalId });
    return { success: true };
  }

  async rejectApplicant(ownerId: string, proposalId: string, applicantId: string, reason?: string) {
    const Proposal = this.mongo.getProposalModel();
    const p: any = await Proposal.findById(proposalId) as any;
    if (!p) throw new Error('Proposal not found');
    if (String(p.ownerId) !== String(ownerId)) throw new Error('Not authorized');

    p.applicants = p.applicants || [];
    const idx = p.applicants.findIndex((a:any)=>String(a.userId) === String(applicantId));
    if (idx === -1) throw new Error('Applicant not found');

    p.applicants[idx].status = 'rejected';
    p.applicants[idx].reason = reason || 'rejected by owner';
    await p.save();

    // notify applicant
    profileEvents.emit('profile.updated', { userId: applicantId, event: 'proposal.rejected', proposalId, reason });
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
