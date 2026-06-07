/**
 * GitHub Authorization URL Generator
 * 
 * Generates GitHub OAuth authorization URLs per OAuth 2.0 specification.
 * Per AUTH_FLOW.md Step 5, generates authorization URLs with state and scope parameters.
 */

import type { OAuthConfig } from './oauth-config.js';

/**
 * Generate GitHub OAuth authorization URL
 * 
 * Creates the authorization URL that redirects users to GitHub for authentication.
 * Per GitHub OAuth documentation: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 * 
 * @param config - OAuth configuration containing client ID and service URL
 * @param state - CSRF protection state parameter (generated securely)
 * @param scope - Requested OAuth scope (space-separated permissions)
 * @returns Complete GitHub authorization URL
 */
export function generateAuthorizationUrl(
  config: OAuthConfig,
  state: string,
  scope: string,
): string {
  // Construct callback redirect URI
  const redirectUri = `${config.serviceUrl}/api/v1/auth/callback`;

  // Build query parameters
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    state: state,
    scope: scope,
  });

  // Construct complete authorization URL
  return `${config.authorizationUrl}?${params.toString()}`;
}
