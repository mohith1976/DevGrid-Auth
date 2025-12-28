import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { PrismaService } from '../prisma.service';
import { decrypt, encrypt } from '../utils/crypto.util';

export class GitHubReconnectRequired extends Error {}

@Injectable()
export class GitHubTokenService {
  private readonly logger = new Logger(GitHubTokenService.name);
  constructor(private readonly prisma: PrismaService) {}

  private now() { return new Date(); }

  // Refresh access token using stored refresh token. Returns object with accessToken and expiry seconds
  private async refreshWithRefreshToken(refreshToken: string) {
    const tokenUrl = 'https://github.com/login/oauth/access_token';
    try {
      const body = new URLSearchParams();
      body.set('grant_type', 'refresh_token');
      body.set('refresh_token', refreshToken);
      if (process.env.GITHUB_CLIENT_ID) body.set('client_id', process.env.GITHUB_CLIENT_ID);
      if (process.env.GITHUB_CLIENT_SECRET) body.set('client_secret', process.env.GITHUB_CLIENT_SECRET);
      const res: AxiosResponse<any> = await axios.post(tokenUrl, body.toString(), {
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!res || !res.data) throw new Error('Empty response from GitHub token endpoint');
      return res.data;
    } catch (e: any) {
      this.logger.warn('Failed to refresh GitHub token', e?.message || e);
      throw e;
    }
  }

  // Main resolver: returns a valid access token or throws GitHubReconnectRequired
  async getValidGitHubAccessToken(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    // Prisma generated types may not include newly added optional fields depending on generated client.
    // Cast to any for token lifecycle fields to avoid TS errors while keeping runtime checks.
    const u: any = user as any;

    // If token valid flag is false, immediately require reconnect
    if (u.githubTokenValid === false) throw new GitHubReconnectRequired('GitHub token invalid - reconnect required');

    const now = this.now();

    // If access token exists and not expired (or no expiry stored), return it
    if (u.githubAccessToken) {
      const accessExpires = u.githubAccessTokenExpiresAt ? new Date(u.githubAccessTokenExpiresAt) : null;
      if (!accessExpires || accessExpires > now) {
        try {
          return decrypt(u.githubAccessToken);
        } catch (e: any) {
          this.logger.warn('Failed to decrypt githubAccessToken for user ' + userId + ': ' + (e?.message || e));
          // fallthrough to attempt refresh
        }
      }
    }

    // At this point access token missing or expired. Try refresh if available
    if (u.githubRefreshToken && (!u.githubRefreshTokenExpiresAt || new Date(u.githubRefreshTokenExpiresAt) > now)) {
      try {
        const refreshTokenPlain = decrypt(u.githubRefreshToken);
        const tokenRes = await this.refreshWithRefreshToken(refreshTokenPlain);
        const newAccessToken = tokenRes.access_token ?? tokenRes.accessToken ?? null;
        const newRefreshToken = tokenRes.refresh_token ?? tokenRes.refreshToken ?? null;
        const expiresIn = Number(tokenRes.expires_in ?? tokenRes.expires ?? 0);
        const refreshExpiresIn = Number(tokenRes.refresh_token_expires_in ?? tokenRes.refresh_expires_in ?? 0);

        if (!newAccessToken) throw new Error('GitHub refresh response did not include access_token');

        const encryptedAccess = encrypt(newAccessToken);
        const update: any = { githubAccessToken: encryptedAccess };
        if (expiresIn && expiresIn > 0) update.githubAccessTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        if (newRefreshToken) update.githubRefreshToken = encrypt(newRefreshToken);
        if (refreshExpiresIn && refreshExpiresIn > 0) update.githubRefreshTokenExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);
        update.githubTokenValid = true;

        // Use raw SQL update to avoid runtime Prisma client schema mismatch
        try {
          const parts: string[] = [];
          const values: any[] = [];
          let idx = 1;
          if (update.githubAccessToken !== undefined) { parts.push(`"githubAccessToken" = $${idx++}`); values.push(update.githubAccessToken); }
          if (update.githubAccessTokenExpiresAt !== undefined) { parts.push(`"githubAccessTokenExpiresAt" = $${idx++}`); values.push(update.githubAccessTokenExpiresAt); }
          if (update.githubRefreshToken !== undefined) { parts.push(`"githubRefreshToken" = $${idx++}`); values.push(update.githubRefreshToken); }
          if (update.githubRefreshTokenExpiresAt !== undefined) { parts.push(`"githubRefreshTokenExpiresAt" = $${idx++}`); values.push(update.githubRefreshTokenExpiresAt); }
          if (update.githubTokenValid !== undefined) { parts.push(`"githubTokenValid" = $${idx++}`); values.push(update.githubTokenValid); }
          if (parts.length > 0) {
            const sql = `UPDATE "User" SET ${parts.join(', ')} WHERE id = $${idx}`;
            values.push(userId);
            await this.prisma.$executeRawUnsafe(sql, ...values);
          }
        } catch (e) {
          this.logger.warn('Failed to persist refreshed tokens via raw SQL: ' + (e as any)?.message || e);
          // fall back to prisma update (best-effort)
          await this.prisma.user.update({ where: { id: userId }, data: update as any });
        }
        return newAccessToken as string;
      } catch (e: any) {
        this.logger.warn('Refresh failed for user ' + userId + ': ' + (e?.message || e));
        // Mark invalid and throw
        try { await this.prisma.user.update({ where: { id: userId }, data: ({ githubTokenValid: false } as any) }); } catch (_){ }
        throw new GitHubReconnectRequired('Failed to refresh token - reconnect required');
      }
    }

    // No valid refresh token available
    try { await this.prisma.user.update({ where: { id: userId }, data: ({ githubTokenValid: false } as any) }); } catch (_){ }
    throw new GitHubReconnectRequired('No valid refresh token - reconnect required');
  }
}
