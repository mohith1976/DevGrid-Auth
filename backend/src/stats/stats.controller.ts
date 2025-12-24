import { Controller, Get, Param, Header, Req, UnauthorizedException } from '@nestjs/common';
import { StatsService } from './stats.service';
import { PrismaService } from '../prisma.service';
import { Request } from 'express';
import { getUserIdFromAuthHeader } from '../auth/request-auth.util';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService, private readonly prisma: PrismaService) {}

  // No manual JWT parsing in this controller. Use shared helper which only
  // reads the `Authorization` header (no ?token support) to resolve user id.

  @Get(':username')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async getSvg(@Param('username') username: string) {
    return this.statsService.getSvgForUser(username);
  }

  @Get(':username.svg')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async getSvgDot(@Param('username') username: string) {
    return this.statsService.getSvgForUser(username);
  }

  // Remove the public SVG alias route. Instead expose an authenticated
  // JSON endpoint that resolves the github username and returns the
  // public embeddable stats URL. This endpoint does not return SVG.
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
}
