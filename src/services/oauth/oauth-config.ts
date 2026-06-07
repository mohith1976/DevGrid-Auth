/**
 * OAuth Configuration
 * 
 * Strongly typed OAuth configuration sourced from environment variables.
 * Per SECURITY_MODEL.md, OAuth Client Secret is protected and never exposed to extension.
 */

/**
 * OAuth Configuration Interface
 * 
 * Contains GitHub OAuth application credentials and service URLs.
 */
export interface OAuthConfig {
  /** GitHub OAuth Client ID (public identifier) */
  readonly clientId: string;

  /** GitHub OAuth Client Secret (protected, never exposed) */
  readonly clientSecret: string;

  /** Authentication service base URL (used for OAuth callback redirect URI) */
  readonly serviceUrl: string;

  /** GitHub OAuth authorization endpoint */
  readonly authorizationUrl: string;

  /** GitHub OAuth token exchange endpoint */
  readonly tokenUrl: string;

  /** GitHub API user endpoint */
  readonly userApiUrl: string;
}

/**
 * Create OAuth configuration from environment-validated config
 * 
 * @param clientId - GitHub OAuth Client ID
 * @param clientSecret - GitHub OAuth Client Secret
 * @param serviceUrl - Authentication service URL
 * @returns Complete OAuth configuration
 */
export function createOAuthConfig(
  clientId: string,
  clientSecret: string,
  serviceUrl: string,
): OAuthConfig {
  return {
    clientId,
    clientSecret,
    serviceUrl,
    // GitHub OAuth endpoints (constants per GitHub OAuth documentation)
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userApiUrl: 'https://api.github.com/user',
  };
}
