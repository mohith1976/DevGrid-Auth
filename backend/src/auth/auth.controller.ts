import { Controller, Get, Query, Res, Req, UnauthorizedException } from '@nestjs/common';
// use any for express objects to avoid lib.dom conflicts in some TS configs
// (kept import for types when available)
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import * as jwt from 'jsonwebtoken';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private prisma: PrismaService) {}

  @Get('github')
  redirectToGithub(@Res() res: any) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_CALLBACK_URL || 'https://api.digitaldevgrid.tech/auth/github/callback';
    const scope = 'read:user user:email';
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&scope=${encodeURIComponent(scope)}`;
    return res.redirect(url);
  }

  @Get('github/callback')
  async handleCallback(@Query('code') code: string, @Res() res: any) {
    const frontend = process.env.FRONTEND_URL || 'https://www.digitaldevgrid.tech';
    try {
      const result = await this.authService.handleGitHubCallback(code);
      const redirectUrl = new URL(frontend);
      redirectUrl.searchParams.set('token', result.token);
      // optionally include minimal user info
      redirectUrl.searchParams.set('userId', result.user.id);
      return res.redirect(redirectUrl.toString());
    } catch (err: any) {
      // On error, redirect back to frontend with a short error message so the UI can show it
      this.authService['logger']?.warn?.(`GitHub callback handling failed: ${err?.message || err}`);
      const redirectUrl = new URL(frontend);
      const safe = String(err?.message || 'GitHub authentication failed').slice(0, 200);
      redirectUrl.searchParams.set('authError', safe);
      return res.redirect(redirectUrl.toString());
    }
  }

  @Get('me')
  async me(@Req() req: any) {
    const authHeader = req.headers?.authorization;
    if (!authHeader) throw new UnauthorizedException();
    const parts = authHeader.split(' ');
    if (parts.length !== 2) throw new UnauthorizedException();
    const token = parts[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
      const userId = payload.sub;
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          githubId: true,
          githubConnectedAt: true,
        },
      });
      if (!user) throw new UnauthorizedException();
      return { user };
    } catch (err) {
      throw new UnauthorizedException();
    }
  }
}
