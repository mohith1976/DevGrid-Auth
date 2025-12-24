import { Controller, Get, Param, Header, Req, UnauthorizedException } from '@nestjs/common';
import { StatsService } from './stats.service';
import { PrismaService } from '../prisma.service';
import { Request } from 'express';
import { getUserIdFromAuthHeader } from '../auth/request-auth.util';
import { parseSvgOptions } from './svg-options.util';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService, private readonly prisma: PrismaService) {}

  // No manual JWT parsing in this controller. Use shared helper which only
  // reads the `Authorization` header (no ?token support) to resolve user id.
  // Authenticated JSON endpoint that resolves the github username and
  // returns the public embeddable stats URL. Place this BEFORE the
  // parameterized routes so Nest matches `/stats/me` correctly.
  // This endpoint does not return SVG.
  @Get('me')
  async getMeJson(@Req() req: Request) {
    try {
      const userId = getUserIdFromAuthHeader(req);
      const dbUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
      if (!dbUser || !dbUser.username) throw new UnauthorizedException();
      const username = dbUser.username;
      const base = process.env.STATS_BASE_URL || 'https://api.digitaldevgrid.tech';
      return { githubUsername: username, statsUrl: `${base.replace(/\/$/, '')}/stats/${encodeURIComponent(username)}.svg` };
    } catch (e) {
      throw new UnauthorizedException();
    }
  }

  @Get(':username')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async getSvg(@Param('username') username: string, @Req() req: any) {
    const options = parseSvgOptions(req.query as any);
    return this.statsService.getSvgForUser(username, 'demo', options);
  }

  @Get(':username.svg')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async getSvgDot(@Param('username') username: string, @Req() req: any) {
    const options = parseSvgOptions(req.query as any);
    return this.statsService.getSvgForUser(username, 'demo', options);
  }
}
