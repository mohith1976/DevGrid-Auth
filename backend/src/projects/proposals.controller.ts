import { Controller, Post, Body, Req, UnauthorizedException, Get, Param } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
// use runtime require to avoid missing @types during TS compile in some environments
const jwt: any = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

@Controller('api/projects/proposals')
export class ProposalsController {
  constructor(private svc: ProposalsService) {}

  private log(...args: any[]) { try { console.log('[ProposalsController]', ...args); } catch(e){} }

  private verifyToken(req: any) {
    const h = req.headers?.authorization;
    const queryToken = req.query?.token;
    const bearer = h?.split(' ');
    const token = (bearer && bearer[1]) || queryToken;
    if (!token) throw new UnauthorizedException();
    try {
      return jwt.verify(token, JWT_SECRET) as any;
    } catch (e) {
      throw new UnauthorizedException();
    }
  }

  @Post('/create')
  async create(@Req() req: any, @Body() body: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    try {
      const created = await this.svc.createProposal(userId, body);
      return { success: true, proposal: created };
    } catch (e:any) {
      return { success: false, message: e?.message || 'Create failed' };
    }
  }

  @Get('/')
  async list(@Req() req: any) {
    // allow public listing; token optional
    try {
      const q = req.query || {};
      this.log('list called, query=', q, 'from', req.ip || req.headers?.['x-forwarded-for'] || req.connection?.remoteAddress);
      const res = await this.svc.listProposals(q);
      this.log('list result count=', Array.isArray(res) ? res.length : typeof res, (Array.isArray(res) ? 'firstId=' + (res[0]?._id || res[0]?.id) : ''));
      return { proposals: res };
    } catch (e:any) { return { proposals: [], message: e?.message }; }
  }

  @Get('/:id')
  async getOne(@Param('id') id: string) {
    try {
      const p = await this.svc.getProposalById(id);
      return { proposal: p };
    } catch (e:any) { return { success: false, message: e?.message }; }
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
