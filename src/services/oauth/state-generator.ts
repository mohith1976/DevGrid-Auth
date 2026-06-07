/**
 * OAuth State Generator
 * 
 * Generates cryptographically secure OAuth state parameters for CSRF protection.
 * Per AUTH_FLOW.md Step 5, state parameters are generated during login initiation.
 * Per SECURITY_MODEL.md, uses secure cryptographic APIs only.
 */

import { randomBytes } from 'crypto';

/**
 * Generate secure OAuth state parameter
 * 
 * Creates a cryptographically secure, URL-safe state parameter suitable for CSRF protection.
 * Uses Node.js crypto.randomBytes for secure random generation.
 * 
 * @returns URL-safe base64url-encoded random state value (32 bytes = 43 characters)
 */
export function generateOAuthState(): string {
  // Generate 32 cryptographically secure random bytes
  // Node.js >= 18 supports base64url encoding natively
  return randomBytes(32).toString('base64url');
}
