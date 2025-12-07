import { Controller, Get, Post, Put, Req, Param, Body, UnauthorizedException } from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';
import { PrismaService } from '../prisma.service';
const jwt: any = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

@Controller('api/teams')
export class TeamsController {
  constructor(private mongo: MongoService, private prisma: PrismaService) {}

  private verifyToken(req: any) {
    const h = req.headers?.authorization;
    const bearer = h?.split(' ');
    const token = (bearer && bearer[1]) || req.query?.token;
    if (!token) throw new UnauthorizedException();
    try { return jwt.verify(token, JWT_SECRET) as any; } catch (e) { throw new UnauthorizedException(); }
  }

  @Get('/:id')
  async getTeam(@Param('id') id: string) {
    const Team = this.mongo.getTeamModel();
    const Proposal = this.mongo.getProposalModel();
    const Profile = this.mongo.getProfileModel();
    const t: any = await Team.findById(id).lean();
    if (!t) return { team: null };
    // enrich members with profile and prisma user info
    const memberIds = (t.members || []).map((m:any) => String(m.userId));
    const uniqueIds = Array.from(new Set(memberIds));
    const userMap: Record<string, any> = {};
    try {
      if (uniqueIds.length > 0 && this.prisma && (this.prisma as any).user) {
        const users = await this.prisma.user.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, username: true, githubId: true } });
        for (const u of users) userMap[String(u.id)] = u;
      }
    } catch(e) { /* ignore */ }

    const profiles = await Profile.find({ userId: { $in: uniqueIds } }).lean();
    const profileMap: Record<string, any> = {};
    for (const p of profiles) profileMap[String(p.userId)] = p;

    t.members = (t.members || []).map((m:any) => {
      const id = String(m.userId);
      const u = userMap[id];
      const prof = profileMap[id];
      return Object.assign({}, m, {
        username: u?.username || null,
        githubId: u?.githubId || null,
        avatarUrl: u?.githubId ? `https://avatars.githubusercontent.com/u/${u.githubId}?s=80&v=4` : (prof ? prof.avatarUrl || null : null),
        profile: prof ? { points: prof.points, level: prof.level } : null
      });
    });

    // attach proposal summary when available
    try {
      if (t.proposalId) {
        const p = await Proposal.findById(t.proposalId).lean();
        if (p) t.proposal = { _id: p._id, title: p.title, repoUrl: p.repoUrl, description: p.description, requirements: p.requirements, teamSize: p.teamSize, status: p.status };
      }
    } catch(e) { /* ignore */ }

    // prepare last message preview
    if (t.messages && t.messages.length > 0) {
      const last = t.messages[t.messages.length - 1];
      t.lastMessage = { userId: last.userId, message: last.message, createdAt: last.createdAt };
    } else t.lastMessage = null;

    return { team: t };
  }

  @Get('/')
  async listMyTeams(@Req() req: any) {
    // return teams where the requesting user is a member or owner
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    const Team = this.mongo.getTeamModel();
    const Proposal = this.mongo.getProposalModel();
    const teams = await Team.find({ $or: [ { ownerId: userId }, { 'members.userId': userId } ] }).sort({ updatedAt: -1 }).lean();
    const enriched = [] as any[];
    // gather all member ids to batch-load profiles/prisma users
    const allMemberIds = new Set<string>();
    for (const t of teams) for (const m of (t.members || [])) allMemberIds.add(String(m.userId));
    const uniqueIds = Array.from(allMemberIds);
    const userMap: Record<string, any> = {};
    try {
      if (uniqueIds.length > 0 && this.prisma && (this.prisma as any).user) {
        const users = await this.prisma.user.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, username: true, githubId: true, email: true } });
        for (const u of users) userMap[String(u.id)] = u;
      }
    } catch (e) { /* ignore */ }

    const Profile = this.mongo.getProfileModel();
    const profiles = uniqueIds.length > 0 ? await Profile.find({ userId: { $in: uniqueIds } }).lean() : [];
    const profileMap: Record<string, any> = {};
    for (const p of profiles) profileMap[String(p.userId)] = p;

    for (const t of teams) {
      const summary: any = { ...t };
      // map members to enriched shape (username, githubId, avatarUrl, profile)
      summary.members = (t.members || []).map((m:any) => {
        const id = String(m.userId);
        const u = userMap[id];
        const prof = profileMap[id];
        return Object.assign({}, m, {
          username: u?.username || null,
          githubId: u?.githubId || null,
          avatarUrl: u?.githubId ? `https://avatars.githubusercontent.com/u/${u.githubId}?s=80&v=4` : (prof ? prof.avatarUrl || null : null),
          email: u?.email || null,
          profile: prof ? { points: prof.points, level: prof.level } : null
        });
      });

      try {
        if (t.proposalId) {
          const p = await Proposal.findById(t.proposalId).lean();
          if (p) summary.proposal = { _id: p._id, title: p.title, repoUrl: p.repoUrl, description: p.description, requirements: p.requirements, teamSize: p.teamSize, status: p.status };
        }
      } catch (e) { /* ignore */ }
      // compute last message preview and try to attach author displayName
      if (summary.messages && summary.messages.length > 0) {
        const last = summary.messages[summary.messages.length - 1];
        const author = (summary.members || []).find((mb:any)=>String(mb.userId) === String(last.userId));
        summary.lastMessage = { userId: last.userId, message: last.message, createdAt: last.createdAt, authorName: author ? (author.username || author.githubId) : null };
      } else summary.lastMessage = null;
      enriched.push(summary);
    }
    return { teams: enriched };
  }

  @Put('/:id')
  async updateTeam(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    const Team = this.mongo.getTeamModel();
    const t: any = await Team.findById(id);
    if (!t) return { success: false, message: 'Team not found' };
    if (String(t.ownerId) !== String(userId)) return { success: false, message: 'Not authorized' };
    if (body.name) t.name = String(body.name).trim();
    if (body.meta) t.meta = Object.assign(t.meta || {}, body.meta);
    await t.save();
    return { success: true, team: t.toObject ? t.toObject() : t };
  }

  @Post('/:id/message')
  async postMessage(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    const Team = this.mongo.getTeamModel();
    const t: any = await Team.findById(id);
    if (!t) return { success: false, message: 'Team not found' };
    // check membership
    const member = (t.members || []).some((m:any)=>String(m.userId) === String(userId));
    if (!member) return { success: false, message: 'Not a member of this team' };
    const msg = { userId, message: String(body.message || ''), createdAt: new Date() };
    t.messages = t.messages || [];
    t.messages.push(msg);
    await t.save();
    return { success: true, message: msg };
  }
}
