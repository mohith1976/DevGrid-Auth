/**
 * GitHub OAuth Client
 * 
 * Centralized GitHub OAuth communication.
 * Per repository constitution: All GitHub OAuth requests go through this client.
 * 
 * Responsibilities:
 * - Exchange authorization code for OAuth token
 * - Retrieve authenticated GitHub user
 * 
 * No business logic. No session logic. No controller logic.
 */

import type { OAuthConfig } from './oauth-config.js';
import type { OAuthToken, AuthenticatedUser } from '../../domain/auth/models.js';
import { AuthErrorCode } from '../../domain/auth/errors.js';

/**
 * GitHub OAuth Error
 * 
 * Thrown when GitHub OAuth communication fails.
 */
export class GitHubOAuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'GitHubOAuthError';
  }
}

/**
 * GitHub OAuth Client
 * 
 * Handles all GitHub OAuth HTTP communication.
 */
export class GitHubOAuthClient {
  /**
   * Exchange authorization code for OAuth access token
   * 
   * Per AUTH_FLOW.md Step 10: Exchange code for token
   * GitHub endpoint: POST https://github.com/login/oauth/access_token
   * 
   * @param config - OAuth configuration
   * @param code - Authorization code from GitHub callback
   * @returns OAuth token (domain model)
   * @throws GitHubOAuthError if exchange fails
   */
  async exchangeCodeForToken(
    config: OAuthConfig,
    code: string,
  ): Promise<OAuthToken> {
    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: code,
        }),
      });

      if (!response.ok) {
        throw new GitHubOAuthError(
          AuthErrorCode.TOKEN_EXCHANGE_FAILED,
          `GitHub token exchange failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json() as {
        access_token?: string;
        token_type?: string;
        scope?: string;
        error?: string;
        error_description?: string;
      };

      // GitHub returns error in response body (200 status)
      if (data.error) {
        throw new GitHubOAuthError(
          AuthErrorCode.TOKEN_EXCHANGE_FAILED,
          `GitHub token exchange error: ${data.error_description || data.error}`,
        );
      }

      if (!data.access_token || !data.token_type || !data.scope) {
        throw new GitHubOAuthError(
          AuthErrorCode.TOKEN_EXCHANGE_FAILED,
          'Invalid token response from GitHub',
        );
      }

      // Map GitHub response to domain model
      return {
        accessToken: data.access_token,
        tokenType: data.token_type,
        scope: data.scope,
        // GitHub tokens typically don't expire, but include if present
        expiresAt: undefined,
      };
    } catch (error) {
      if (error instanceof GitHubOAuthError) {
        throw error;
      }

      throw new GitHubOAuthError(
        AuthErrorCode.TOKEN_EXCHANGE_FAILED,
        'Failed to exchange authorization code for token',
        error,
      );
    }
  }

  /**
   * Fetch authenticated user information from GitHub
   * 
   * Per AUTH_FLOW.md Step 11: Retrieve user information
   * GitHub endpoint: GET https://api.github.com/user
   * 
   * @param config - OAuth configuration
   * @param token - OAuth access token
   * @returns Authenticated user (domain model)
   * @throws GitHubOAuthError if fetch fails
   */
  async fetchAuthenticatedUser(
    config: OAuthConfig,
    token: OAuthToken,
  ): Promise<AuthenticatedUser> {
    try {
      const response = await fetch(config.userApiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${token.accessToken}`,
          'User-Agent': 'DevGrid-Auth',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new GitHubOAuthError(
            AuthErrorCode.UNAUTHORIZED,
            'GitHub authentication failed: Invalid token',
          );
        }

        throw new GitHubOAuthError(
          AuthErrorCode.AUTHENTICATION_FAILED,
          `GitHub user fetch failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json() as {
        id?: number;
        login?: string;
        name?: string | null;
        avatar_url?: string | null;
      };

      // Validate required fields
      if (!data.id || !data.login) {
        throw new GitHubOAuthError(
          AuthErrorCode.AUTHENTICATION_FAILED,
          'Invalid user response from GitHub',
        );
      }

      // Map GitHub response to domain model
      return {
        githubId: data.id,
        username: data.login,
        displayName: data.name || undefined,
        avatarUrl: data.avatar_url || undefined,
      };
    } catch (error) {
      if (error instanceof GitHubOAuthError) {
        throw error;
      }

      throw new GitHubOAuthError(
        AuthErrorCode.AUTHENTICATION_FAILED,
        'Failed to fetch user information from GitHub',
        error,
      );
    }
  }
}
