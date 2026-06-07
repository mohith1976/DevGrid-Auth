/**
 * Authentication Code Store
 * 
 * Temporary in-memory storage for authentication results.
 * 
 * Requirements:
 * - 60 second expiration
 * - Single-use enforcement
 * - No persistence
 * - No database
 * - No Redis
 * - Automatic cleanup
 * 
 * Purpose:
 * Temporarily store AuthResult for one-time code exchange after OAuth callback.
 */

import type { AuthResult } from '../../domain/auth/models.js';

/**
 * Stored Authentication Result
 * 
 * Associates authentication result with creation timestamp for expiration.
 */
interface StoredAuthenticationResult {
  /** Authentication result from OAuth flow */
  readonly authResult: AuthResult;
  
  /** Creation timestamp (milliseconds since epoch) */
  readonly createdAt: number;
}

/**
 * Authentication Code Store
 * 
 * In-memory store for temporary authentication result storage.
 * 
 * Security characteristics:
 * - Single-use: Codes consumed on retrieval
 * - Short-lived: 60 second expiration
 * - Automatic cleanup: Expired entries removed during operations
 */
export class AuthCodeStore {
  /** In-memory storage: authCode → StoredAuthenticationResult */
  private readonly storage = new Map<string, StoredAuthenticationResult>();

  /** Expiration time in milliseconds (60 seconds) */
  private readonly EXPIRATION_MS = 60 * 1000;

  /**
   * Store authentication result with generated code
   * 
   * @param authCode - Generated authentication code
   * @param authResult - Authentication result from OAuth flow
   */
  store(authCode: string, authResult: AuthResult): void {
    // Clean expired entries before storing new one
    this.cleanExpired();

    // Store with current timestamp
    this.storage.set(authCode, {
      authResult,
      createdAt: Date.now(),
    });
  }

  /**
   * Retrieve authentication result without consuming
   * 
   * Used for validation - does NOT remove entry.
   * Use consume() for single-use enforcement.
   * 
   * @param authCode - Authentication code to retrieve
   * @returns Authentication result if exists and not expired, null otherwise
   */
  retrieve(authCode: string): AuthResult | null {
    const stored = this.storage.get(authCode);

    if (!stored) {
      return null;
    }

    // Check expiration
    const now = Date.now();
    const age = now - stored.createdAt;

    if (age > this.EXPIRATION_MS) {
      // Expired - remove and return null
      this.storage.delete(authCode);
      return null;
    }

    return stored.authResult;
  }

  /**
   * Consume authentication code (single-use)
   * 
   * Retrieves and removes entry in single operation.
   * 
   * @param authCode - Authentication code to consume
   * @returns Authentication result if exists and not expired, null otherwise
   */
  consume(authCode: string): AuthResult | null {
    const authResult = this.retrieve(authCode);

    if (authResult) {
      // Remove entry (single-use enforcement)
      this.storage.delete(authCode);
    }

    return authResult;
  }

  /**
   * Clean expired entries
   * 
   * Removes all expired authentication codes from store.
   * Called automatically during store() and can be called explicitly.
   * 
   * @returns Number of entries removed
   */
  cleanExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [authCode, stored] of this.storage.entries()) {
      const age = now - stored.createdAt;

      if (age > this.EXPIRATION_MS) {
        this.storage.delete(authCode);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get current store size (for testing/debugging)
   * 
   * @returns Number of entries in store
   */
  size(): number {
    return this.storage.size;
  }
}

