/**
 * Authentication Code Generator
 * 
 * Generates cryptographically secure one-time authentication codes.
 * 
 * Security Requirements:
 * - Cryptographically secure random generation
 * - URL-safe encoding
 * - Comparable security level to OAuth state generation
 * - Non-sequential
 * - Unpredictable
 */

import { randomBytes } from 'crypto';

/**
 * Generate secure authentication code
 * 
 * Uses crypto.randomBytes() for cryptographic security.
 * Encodes with base64url for URL-safety.
 * 
 * @returns Secure authentication code
 */
export function generateAuthCode(): string {
  // Generate 32 random bytes (256 bits of entropy)
  // Comparable to OAuth state generation security level
  return randomBytes(32).toString('base64url');
}

