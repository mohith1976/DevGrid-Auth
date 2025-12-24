import { Controller, Get, Param, Header, Req } from '@nestjs/common';
import { StatsService } from './stats.service';
import { PrismaService } from '../prisma.service';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // inject Prisma lazily to avoid circulars in some setups
  private _prisma: PrismaService | null = null;
  private get prisma(): PrismaService {
    if (!this._prisma) {
      // require at runtime from module injector using global import
      // this assumes PrismaService is provided in AppModule
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this._prisma = require('../prisma.service').PrismaService;
    }
    return this._prisma as PrismaService;
  }

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

  @Get('me.svg')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async getMe(@Req() req: Request) {
    try {
      const authHeader = (req.headers as any)?.authorization;
      if (!authHeader) {
        // return SVG explaining login required
        return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="560" height="120" viewBox="0 0 560 120" role="img" aria-label="Login required">\n  <rect width="100%" height="100%" fill="#0b1226" rx="8"/>\n  <text x="28" y="36" fill="#ffffff" font-size="18" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>\n  <text x="28" y="62" fill="#ff6b6b" font-size="14" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">Login required — please sign in to view your personal stats</text>\n</svg>`;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2) {
        return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="560" height="120" viewBox="0 0 560 120" role="img" aria-label="Login required">\n  <rect width="100%" height="100%" fill="#0b1226" rx="8"/>\n  <text x="28" y="36" fill="#ffffff" font-size="18" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>\n  <text x="28" y="62" fill="#ff6b6b" font-size="14" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">Login required — please sign in to view your personal stats</text>\n</svg>`;
      }

      const token = parts[1];
      let payload: any = null;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
      } catch (err) {
        return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="560" height="120" viewBox="0 0 560 120" role="img" aria-label="Login required">\n  <rect width="100%" height="100%" fill="#0b1226" rx="8"/>\n  <text x="28" y="36" fill="#ffffff" font-size="18" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>\n  <text x="28" y="62" fill="#ff6b6b" font-size="14" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">Login required — please sign in to view your personal stats</text>\n</svg>`;
      }

      const userId = payload?.sub;
      if (!userId) {
        return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="560" height="120" viewBox="0 0 560 120" role="img" aria-label="Login required">\n  <rect width="100%" height="100%" fill="#0b1226" rx="8"/>\n  <text x="28" y="36" fill="#ffffff" font-size="18" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>\n  <text x="28" y="62" fill="#ff6b6b" font-size="14" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">Login required — please sign in to view your personal stats</text>\n</svg>`;
      }

      // fetch user record to get GitHub username
      const prismaModule = require('../prisma.service');
      const prisma = new prismaModule.PrismaService();
      await prisma.$connect?.();
      try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
        await prisma.$disconnect?.();
        if (!user || !user.username) {
          return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="560" height="120" viewBox="0 0 560 120" role="img" aria-label="Login required">\n  <rect width="100%" height="100%" fill="#0b1226" rx="8"/>\n  <text x="28" y="36" fill="#ffffff" font-size="18" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>\n  <text x="28" y="62" fill="#ff6b6b" font-size="14" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">Login required — please sign in to view your personal stats</text>\n</svg>`;
        }

        // call existing stats flow with resolved username
        return this.statsService.getSvgForUser(user.username);
      } catch (err) {
        try { await prisma.$disconnect?.(); } catch(_) {}
        return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="560" height="120" viewBox="0 0 560 120" role="img" aria-label="Login required">\n  <rect width="100%" height="100%" fill="#0b1226" rx="8"/>\n  <text x="28" y="36" fill="#ffffff" font-size="18" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>\n  <text x="28" y="62" fill="#ff6b6b" font-size="14" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">Login required — please sign in to view your personal stats</text>\n</svg>`;
      }
    } catch (err) {
      return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="560" height="120" viewBox="0 0 560 120" role="img" aria-label="Login required">\n  <rect width="100%" height="100%" fill="#0b1226" rx="8"/>\n  <text x="28" y="36" fill="#ffffff" font-size="18" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>\n  <text x="28" y="62" fill="#ff6b6b" font-size="14" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">Login required — please sign in to view your personal stats</text>\n</svg>`;
    }
  }
}
