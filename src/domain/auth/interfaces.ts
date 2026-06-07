/**
 * Authentication Service Interfaces
 * 
 * Defines contracts for authentication service implementations.
 */

import type {
  AuthenticatedUser,
  OAuthToken,
  AuthSession,
  AuthResult,
} from './models.js';

/**
 * OAuth Provider Interface
 * 
 * Defines contract for GitHub OAuth communication.
 * Per AUTH_FLOW.md, handles OAuth authorization flow and token exchange.
 */
export interface IOAuthProvider {
  /**
   * Generate OAuth authorization URL
   * AUTH_FLOW.md Step 5
   * 
   * @param state - CSRF protection state parameter
   * @param scope - Requested OAuth scope
   * @returns Authorization URL to redirect user to GitHub
   */
  generateAuthorizationUrl(state: string, scope: string): string;

  /**
   * Exchange authorization code for access token
   * AUTH_FLOW.md Step 10
   * 
   * @param code - Authorization code from GitHub callback
   * @returns OAuth token (domain model)
   */
  exchangeCodeForToken(code: string): Promise<OAuthToken>;

  /**
   * Fetch authenticated user information
   * AUTH_FLOW.md Step 11
   * 
   * @param accessToken - OAuth access token
   * @returns Authenticated user domain model
   */
  fetchUserInfo(accessToken: string): Promise<AuthenticatedUser>;
}

/**
 * Auth Service Interface
 * 
 * Defines contract for authentication workflow orchestration.
 * Per AUTH_FLOW.md, handles login, callback, and logout flows.
 */
export interface IAuthService {
  /**
   * Initiate authentication flow
   * AUTH_FLOW.md Steps 4-5
   * API_CONTRACT.md GET /api/v1/auth/login
   * 
   * @returns Authorization URL and state parameter
   */
  initiateLogin(): Promise<{
    authorizationUrl: string;
    state: string;
  }>;

  /**
   * Handle OAuth callback
   * AUTH_FLOW.md Steps 8-11
   * API_CONTRACT.md GET /api/v1/auth/callback
   * 
   * @param code - Authorization code from GitHub
   * @param state - State parameter for validation
   * @returns Complete authentication result
   */
  handleCallback(code: string, state: string): Promise<AuthResult>;

  /**
   * Logout user
   * AUTH_FLOW.md Logout Flow
   * API_CONTRACT.md POST /api/v1/auth/logout
   * 
   * @param sessionId - Session to terminate
   */
  logout(sessionId: string): Promise<void>;
}

/**
 * Session Service Interface
 * 
 * Defines contract for session lifecycle management.
 * Per DEPLOYMENT.md, session storage should remain minimal and focused on authentication.
 */
export interface ISessionService {
  /**
   * Create new authentication session
   * Called after successful OAuth callback
   * 
   * @param githubUserId - GitHub user ID to associate with session
   * @returns Created session metadata
   */
  createSession(githubUserId: number): Promise<AuthSession>;

  /**
   * Validate session and retrieve session details
   * AUTH_FLOW.md Session Validation Flow
   * API_CONTRACT.md GET /api/v1/session/validate
   * API_CONTRACT.md GET /api/v1/session/me
   * 
   * Returns session metadata if valid, null if invalid/expired/missing.
   * Serves dual purpose: validation + retrieval.
   * 
   * @param sessionId - Session to validate
   * @returns Session metadata if valid, null if invalid/expired/missing
   */
  validateSession(sessionId: string): Promise<AuthSession | null>;

  /**
   * Destroy session
   * Called during logout
   * 
   * @param sessionId - Session to destroy
   */
  destroySession(sessionId: string): Promise<void>;
}

/**
 * Token Service Interface
 * 
 * Defines contract for token operations.
 * Per SECURITY_MODEL.md, OAuth access tokens are stored in the extension.
 */
export interface ITokenService {
  /**
   * Create OAuth token from GitHub response
   * 
   * @param accessToken - Access token value
   * @param tokenType - Token type (typically 'bearer')
   * @param scope - OAuth scope granted
   * @returns OAuth token contract
   */
  createToken(
    accessToken: string,
    tokenType: string,
    scope: string
  ): OAuthToken;

  /**
   * Validate token format
   * 
   * @param token - Token to validate
   * @returns true if token is valid
   */
  validateToken(token: OAuthToken): boolean;
}
