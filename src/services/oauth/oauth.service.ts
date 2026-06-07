/**
 * OAuth Service
 * 
 * Handles GitHub OAuth operations.
 * Per AUTH_FLOW.md, responsible for OAuth authorization flow.
 * 
 * Responsibilities:
 * - Authorization URL generation with state
 * - State storage for CSRF protection
 * - OAuth callback processing
 * - Token exchange coordination
 * - User retrieval coordination
 */

import { Injectable } from '@nestjs/common';
import type { OAuthConfig } from './oauth-config.js';
import { createOAuthConfig } from './oauth-config.js';
import { generateOAuthState } from './state-generator.js';
import { generateAuthorizationUrl } from './url-generator.js';
import { OAuthStateStore } from './state-store.js';
import { GitHubOAuthClient, GitHubOAuthError } from './github-oauth-client.js';
import { AuthCodeService } from '../auth-code/auth-code.service.js';
import type { AuthResult } from '../../domain/auth/models.js';
import { AuthErrorCode } from '../../domain/auth/errors.js';
import { getConfig } from '../../config/index.js';

/**
 * OAuth Service Error
 * 
 * Thrown when OAuth operations fail.
 */
export class OAuthServiceError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OAuthServiceError';
  }
}

/**
 * OAuth Service
 * 
 * Coordinates OAuth operations including state management and GitHub communication.
 */
@Injectable()
export class OAuthService {
  private readonly stateStore = new OAuthStateStore();
  private readonly githubClient = new GitHubOAuthClient();
  private readonly authCodeService: AuthCodeService;
  private readonly oauthConfig: OAuthConfig;

  constructor(authCodeService: AuthCodeService) {
    // Initialize OAuth configuration once at construction
    const config = getConfig();
    this.oauthConfig = createOAuthConfig(
      config.github.clientId,
      config.github.clientSecret,
      config.service.url,
    );
    this.authCodeService = authCodeService;
  }

  /**
   * Generate OAuth authorization URL with secure state parameter
   * AUTH_FLOW.md Step 5
   * 
   * Generates state, stores it for later validation, and creates authorization URL.
   * 
   * @param scope - Requested OAuth scope (e.g., 'repo user')
   * @returns Authorization URL and state parameter
   */
  generateAuthorizationRequest(scope: string): {
    authorizationUrl: string;
    state: string;
  } {
    // Clean up expired states before storing new one (Fix 2)
    this.stateStore.cleanExpired();

    // Generate secure state parameter for CSRF protection
    const state = generateOAuthState();

    // Store state for callback validation
    this.stateStore.store(state);

    // Generate GitHub authorization URL
    const authorizationUrl = generateAuthorizationUrl(
      this.oauthConfig,
      state,
      scope,
    );

    return {
      authorizationUrl,
      state,
    };
  }

  /**
   * Handle OAuth callback and generate authentication code
   * AUTH_FLOW.md Steps 8-12
   * 
   * Validates state, exchanges code for token, retrieves user, generates auth code.
   * 
   * Callback Flow:
   * 1. Validate state exists (CSRF protection)
   * 2. Exchange authorization code for token
   * 3. Retrieve authenticated user from GitHub
   * 4. Generate one-time authentication code
   * 5. Store authentication result
   * 6. Consume OAuth state (single-use, after successful completion)
   * 7. Return authentication code for extension redirect
   * 
   * State is consumed AFTER successful OAuth completion to allow retry on GitHub failure.
   * 
   * @param code - Authorization code from GitHub
   * @param state - State parameter for validation
   * @returns Authentication code for extension redirect
   * @throws OAuthServiceError if callback processing fails
   */
  async handleCallback(code: string, state: string): Promise<string> {
    // Step 1: Validate state exists
    const isValid = this.stateStore.validate(state);
    if (!isValid) {
      throw new OAuthServiceError(
        AuthErrorCode.INVALID_STATE,
        'Invalid or expired OAuth state parameter',
      );
    }

    try {
      // Step 2: Exchange authorization code for OAuth token
      const token = await this.githubClient.exchangeCodeForToken(
        this.oauthConfig,
        code,
      );

      // Step 3: Retrieve authenticated user
      const user = await this.githubClient.fetchAuthenticatedUser(
        this.oauthConfig,
        token,
      );

      // Step 4: Build authentication result
      const authResult: AuthResult = {
        user,
        token,
        // session is optional - will be added by session service (Phase 4D)
      };

      // Step 5: Generate and store authentication code
      const authCode = this.authCodeService.generateAndStore(authResult);

      // Step 6: Consume state after successful OAuth completion
      // State is consumed here (not earlier) to allow retry if GitHub fails
      this.stateStore.consume(state);

      // Step 7: Return authentication code for redirect
      return authCode;
    } catch (error) {
      // If GitHub operations fail, state remains valid for retry
      if (error instanceof GitHubOAuthError) {
        throw new OAuthServiceError(error.code, error.message);
      }

      throw new OAuthServiceError(
        AuthErrorCode.AUTHENTICATION_FAILED,
        'OAuth callback processing failed',
      );
    }
  }

  /**
   * Clean up expired states
   * 
   * Can be called explicitly for maintenance.
   * Also called automatically before storing new states.
   * 
   * @returns Number of states removed
   */
  cleanExpiredStates(): number {
    return this.stateStore.cleanExpired();
  }
}

