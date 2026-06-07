/**
 * Authentication Domain Models
 * 
 * Core domain contracts for authentication entities.
 */

/**
 * Authenticated User
 * 
 * Represents authenticated GitHub user identity.
 * Contains minimal user information required by DevGrid.
 */
export interface AuthenticatedUser {
  /** GitHub user ID (stable identifier) */
  readonly githubId: number;

  /** GitHub username */
  readonly username: string;

  /** User display name (optional) */
  readonly displayName?: string;

  /** User avatar URL (optional) */
  readonly avatarUrl?: string;
}

/**
 * OAuth Token
 * 
 * Represents GitHub OAuth credentials returned after successful authentication.
 * Per AUTH_FLOW.md, OAuth access tokens are returned to the extension.
 */
export interface OAuthToken {
  /** OAuth access token value */
  readonly accessToken: string;

  /** Token type (always 'bearer' for GitHub OAuth) */
  readonly tokenType: string;

  /** OAuth scope granted */
  readonly scope: string;

  /** Token expiration timestamp (optional, GitHub tokens may not expire) */
  readonly expiresAt?: Date;
}

/**
 * OAuth State
 * 
 * Represents OAuth state parameter for CSRF protection.
 * Per AUTH_FLOW.md Step 5, state parameter is generated during login initiation.
 */
export interface OAuthState {
  /** Unique state parameter value */
  readonly state: string;

  /** State creation timestamp */
  readonly createdAt: Date;
}

/**
 * Auth Session
 * 
 * Represents DevGrid authentication session metadata.
 * Per DEPLOYMENT.md, session storage should remain minimal and focused on authentication.
 */
export interface AuthSession {
  /** Unique session identifier */
  readonly sessionId: string;

  /** GitHub user ID associated with this session */
  readonly githubUserId: number;

  /** Session creation timestamp */
  readonly createdAt: Date;

  /** Session expiration timestamp */
  readonly expiresAt: Date;
}

/**
 * Auth Result
 * 
 * Represents successful authentication outcome.
 * Contains user and token information returned after OAuth flow completion.
 * Session metadata is optional and will be added when session service is implemented.
 */
export interface AuthResult {
  /** Authenticated user information */
  readonly user: AuthenticatedUser;

  /** OAuth token credentials */
  readonly token: OAuthToken;

  /** Authentication session metadata (optional, created by session service) */
  readonly session?: AuthSession;
}
