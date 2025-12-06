import { Controller, Post, Body, Req, UnauthorizedException, Get, Param, Sse, MessageEvent } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import * as jwt from 'jsonwebtoken';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { profileEvents } from '../events/profile-events';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

@Controller('api/projects')
export class ProjectsController {
  constructor(private svc: ProjectsService) {}

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

  @Post()
  async addProject(@Req() req: any, @Body() body: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    try {
      const result = await this.svc.createAndVerify(userId, body);
      return { success: true, ...result };
    } catch (e: any) {
      // normalize error to shape frontend expects
      return { success: false, message: e?.message || 'Verification failed' };
    }
  }

  @Get()
  async list(@Req() req: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    return this.svc.listForUser(userId);
  }

  @Get('/profile/me')
  async profileMe(@Req() req: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    const profile = await this.svc.getProfileForUser(userId);
    // also include aggregated GitHub account stats
    const aggregate = await this.svc.getGithubAggregateForUser(userId);
    return { profile, aggregate };
  }

  @Get('/profile/aggregate')
  async profileAggregate(@Req() req: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    const aggregate = await this.svc.getGithubAggregateForUser(userId);
    return { aggregate };
  }

  @Get('/repos')
  async listGithubRepos(@Req() req: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    const repos = await this.svc.getUserReposForUser(userId);
    return { repos };
  }

  @Post('/publish')
  async publish(@Req() req: any, @Body() body: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    const repo = body?.repo || body?.repoFullName || body?.repoUrl;
    const includeCollaborators = !!body?.includeCollaborators;
    if (!repo) return { success: false, message: 'Missing repo to publish' };
    try {
      const result = await this.svc.publishRepoForUser(userId, repo, includeCollaborators);
      return { success: true, ...result };
    } catch (e:any) {
      return { success: false, message: e?.message || 'Publish failed' };
    }
  }

  @Post('/unpublish')
  async unpublish(@Req() req: any, @Body() body: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    const repo = body?.repo || body?.repoFullName || body?.repoUrl;
    if (!repo) return { success: false, message: 'Missing repo to unpublish' };
    try {
      const result = await this.svc.unpublishRepoForUser(userId, repo);
      return { success: true, ...result };
    } catch (e:any) {
      return { success: false, message: e?.message || 'Unpublish failed' };
    }
  }

  // Temporary debugging endpoint: force account-level language aggregation now
  @Post('/trigger-agg')
  async triggerAggregation(@Req() req: any) {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    try {
      const prof = await this.svc.performAccountLanguageAggregation(userId);
      return { success: true, profile: prof };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Aggregation failed' };
    }
  }

  @Sse('/events')
  events(@Req() req: any): Observable<MessageEvent> {
    const decoded = this.verifyToken(req);
    const userId = decoded.sub;
    return new Observable((subscriber) => {
      const handler = (payload: any) => {
        if (payload?.userId === userId) {
          subscriber.next({ data: payload });
        }
      };
      profileEvents.on('profile.updated', handler);
      return () => profileEvents.off('profile.updated', handler);
    }).pipe(filter(Boolean), map((v:any)=>v));
  }

  

  @Get('/public/:username')
  async publicProfile(@Param('username') username: string) {
    const data = await this.svc.getPublicProfileByUsername(username);
    if (!data) return { error: 'not found' };
    return data;
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    // simple retrieve from mongo via service
    // implemented in service if needed; for now leave placeholder
    return { id };
  }
}

