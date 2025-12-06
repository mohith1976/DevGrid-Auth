import { Controller, Get, Post, Body, Req, Param, UnauthorizedException } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
const jwt: any = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

@Controller('api/proposals')
export class PublicProposalsController {
  constructor(private svc: ProposalsService) {}

  private log(...args: any[]) { try { console.log('[PublicProposalsController]', ...args); } catch(e){} }

  // Public listing of proposals
  @Get('/')
  async list(@Req() req: any) {
    try {
      const q = req.query || {};
      this.log('list called, query=', q);
      const res = await this.svc.listProposals(q);
      this.log('list result count=', Array.isArray(res) ? res.length : 0);
      return { proposals: res };
    } catch (e:any) { return { proposals: [], message: e?.message || 'List failed' }; }
  }

  @Get('/:id')
  async getOne(@Param('id') id: string) {
    try {
      const p = await this.svc.getProposalById(id);
      return { proposal: p };
    } catch (e:any) { return { success: false, message: e?.message || 'Get failed' }; }
  }

  // Create requires auth
  private verifyToken(req: any) {
    const h = req.headers?.authorization;
    const queryToken = req.query?.token;
    const bearer = h?.split(' ');
    const token = (bearer && bearer[1]) || queryToken;
    if (!token) throw new UnauthorizedException();
    try { return jwt.verify(token, JWT_SECRET) as any; } catch (e) { throw new UnauthorizedException(); }
  }

  @Post('/create')
  async create(@Req() req: any, @Body() body: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    try {
      const created = await this.svc.createProposal(userId, body);
      return { success: true, proposal: created };
    } catch (e:any) { return { success: false, message: e?.message || 'Create failed' }; }
  }

  @Post('/:id/apply')
  async apply(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    try {
      const res = await this.svc.applyToProposal(userId, id, body?.message);
      return res;
    } catch (e:any) { return { success: false, message: e?.message || 'Apply failed' }; }
  }

  @Get('/:id/applicants')
  async applicants(@Req() req: any, @Param('id') id: string) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    try {
      const res = await this.svc.listApplicants(userId, id);
      return { applicants: res };
    } catch (e:any) { return { success: false, message: e?.message || 'List applicants failed' }; }
  }

  @Post('/:id/accept')
  async accept(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    const applicantId = body?.applicantId;
    try {
      const res = await this.svc.acceptApplicant(userId, id, applicantId);
      return res;
    } catch (e:any) { return { success: false, message: e?.message || 'Accept failed' }; }
  }

  @Post('/:id/reject')
  async reject(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    const applicantId = body?.applicantId;
    const reason = body?.reason;
    try {
      const res = await this.svc.rejectApplicant(userId, id, applicantId, reason);
      return res;
    } catch (e:any) { return { success: false, message: e?.message || 'Reject failed' }; }
  }

  @Post('/:id/complete')
  async complete(@Req() req: any, @Param('id') id: string) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    try {
      const res = await this.svc.completeProposal(userId, id);
      return res;
    } catch (e:any) { return { success: false, message: e?.message || 'Complete failed' }; }
  }
}
