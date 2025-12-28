import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma.service';
import { signJwt } from './jwt.util';
import { encrypt } from '../utils/crypto.util';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private prisma: PrismaService) {}

  private async exchangeCodeForToken(code: string) {
    const tokenUrl = 'https://github.com/login/oauth/access_token';
    const body = new URLSearchParams();
    if (process.env.GITHUB_CLIENT_ID) body.set('client_id', process.env.GITHUB_CLIENT_ID);
    if (process.env.GITHUB_CLIENT_SECRET) body.set('client_secret', process.env.GITHUB_CLIENT_SECRET);
    body.set('code', code);

    const res = await axios.post(tokenUrl, body.toString(), {
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    // res.data typically contains: { access_token, scope, token_type }
    // Log the returned scope (safe to log). Do NOT log the access_token.
    const returnedScope = res.data?.scope || null;
    this.logger.log(`GitHub token exchange returned scope: ${returnedScope}`);
    try {
      const logsDir = join(process.cwd(), 'backend', 'logs');
      if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
      const out = { ts: new Date().toISOString(), event: 'token_exchange', scope: returnedScope, token_type: res.data?.token_type ?? null };
      appendFileSync(join(logsDir, 'oauth.log'), JSON.stringify(out) + '\n');
    } catch (e) {
      this.logger.warn('Failed to write oauth log');
    }
    // Normalize keys
    return res.data;
  }

  private async fetchGitHubUser(accessToken: string) {
    try {
      const res = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `token ${accessToken}` },
      });
      const user = res.data;
      const scopesHeader = res.headers?.['x-oauth-scopes'] || res.headers?.['X-OAuth-Scopes'] || null;
      // make sure we have email
      if (!user.email) {
        try {
          const emails = await axios.get('https://api.github.com/user/emails', {
            headers: { Authorization: `token ${accessToken}` },
          });
          const primary = emails.data.find((e: any) => e.primary) || emails.data[0];
          user.email = primary?.email;
        } catch (err) {
          this.logger.warn('Could not fetch user emails from GitHub');
        }
      }
      return { user, scopesHeader };
    } catch (err: any) {
      // Provide clearer logs for 403/401 and other axios errors to help debugging
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 403 || status === 401) {
        this.logger.error(`GitHub API returned ${status} when fetching /user. Response: ${JSON.stringify(data)}`);
        throw new Error(`GitHub API access error (${status}). Check token permissions and rate limits.`);
      }
      this.logger.error('Unexpected error fetching GitHub user', err?.message || err);
      throw err;
    }
  }

  async handleGitHubCallback(code: string) {
    const tokenResponse = await this.exchangeCodeForToken(code);
    const accessToken = tokenResponse?.access_token || tokenResponse?.accessToken;
    const refreshToken = tokenResponse?.refresh_token || tokenResponse?.refreshToken;
    const expiresIn = tokenResponse?.expires_in ? Number(tokenResponse.expires_in) : undefined;
    const refreshExpiresIn = tokenResponse?.refresh_token_expires_in ? Number(tokenResponse.refresh_token_expires_in) : undefined;
    const scope = tokenResponse?.scope || null;
    if (!accessToken) throw new Error('Failed to get access token from GitHub');

    const { user: ghUser, scopesHeader } = await this.fetchGitHubUser(accessToken);

    // upsert user in Postgres via Prisma
    const githubId = String(ghUser.id);
    const username = ghUser.login;
    const email = ghUser.email || null;
    const fullName = ghUser.name || null;
    const avatarUrl = ghUser.avatar_url || null;

    const user = await this.prisma.user.upsert({
      where: { githubId },
      update: {
        username,
        email,
        fullName,
        avatarUrl,
      },
      create: {
        username,
        email,
        fullName,
        avatarUrl,
        githubId,
      },
    });

    // We no longer persist github scope (GitHub responses are inconsistent).
    this.logger.log(`Resolved GitHub scope (not persisted) for user ${githubId}: ${scope || scopesHeader || null}`);
    try {
      const logsDir = join(process.cwd(), 'backend', 'logs');
      if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
      const finalScope = scope || scopesHeader || null;
      const out = { ts: new Date().toISOString(), event: 'resolved_scope', githubId, finalScope };
      appendFileSync(join(logsDir, 'oauth.log'), JSON.stringify(out) + '\n');
    } catch (e) {
      this.logger.warn('Failed to write oauth log');
    }

    // encrypt and store GitHub access token and optional refresh token on the User record in Postgres
    try {
      const encrypted = encrypt(accessToken);
      const updateData: any = {
        githubAccessToken: encrypted,
        requestedScopes: process.env.REQUESTED_SCOPES || 'read:user user:email',
        githubConnectedAt: new Date(),
        githubTokenValid: true,
      };
      if (expiresIn && Number.isFinite(expiresIn) && expiresIn > 0) updateData.githubAccessTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
      if (refreshToken) {
        try { updateData.githubRefreshToken = encrypt(refreshToken); } catch (e) { this.logger.warn('Failed to encrypt refresh token'); }
      }
      if (refreshExpiresIn && Number.isFinite(refreshExpiresIn) && refreshExpiresIn > 0) updateData.githubRefreshTokenExpiresAt = new Date(Date.now() + Number(refreshExpiresIn) * 1000);
      await this.prisma.user.update({ where: { id: user.id }, data: updateData });
    } catch (err: any) {
      this.logger.warn('Failed to encrypt or save GitHub access token/refresh token');
    }

    // perform runtime capability checks and persist booleans
    try {
      // decrypt is available locally but we already have accessToken
      const token = accessToken;
      const headers = { Authorization: `token ${token}`, 'User-Agent': 'DevGrid' };
      let canReadUser = false;
      let canReadEmail = false;
      let canReadRepos = false;

      try {
        const r = await axios.get('https://api.github.com/user', { headers });
        if (r.status === 200) canReadUser = true;
      } catch (e: any) {
        // ignore
      }

      try {
        const r = await axios.get('https://api.github.com/user/emails', { headers });
        if (r.status === 200 && Array.isArray(r.data)) canReadEmail = true;
      } catch (e: any) {
        // ignore
      }

      try {
        const r = await axios.get('https://api.github.com/user/repos?per_page=1', { headers });
        if (r.status === 200) canReadRepos = true;
      } catch (e) {
        // ignore
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { canReadUser, canReadEmail, canReadRepos },
      });
    } catch (e: any) {
      this.logger.warn('Capability checks failed', (e as any)?.message || e);
    }

    const token = signJwt({ sub: user.id });

    return { token, user };
  }
}
