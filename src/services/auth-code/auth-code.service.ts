/**
 * Authentication Code Service
 * 
 * Coordinates authentication code operations.
 * 
 * Responsibilities:
 * - Generate authentication codes
 * - Store authentication results
 * - Exchange authentication codes
 * 
 * NOT responsible for:
 * - OAuth logic (belongs to OAuth service)
 * - GitHub logic (belongs to GitHub client)
 * - Session logic (belongs to future session service)
 */

import { Injectable } from '@nestjs/common';
import { generateAuthCode } from './auth-code-generator.js';
import { AuthCodeStore } from './auth-code-store.js';
import type { AuthResult } from '../../domain/auth/models.js';
import { AuthErrorCode } from '../../domain/auth/errors.js';

/**
 * Authentication Code Service Error
 * 
 * Thrown when authentication code operations fail.
 */
export class AuthCodeServiceError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthCodeServiceError';
  }
}

/**
 * Authentication Code Service
 * 
 * Manages temporary authentication codes for OAuth completion flow.
 */
@Injectable()
export class AuthCodeService {
  private readonly codeStore = new AuthCodeStore();

  /**
   * Generate and store authentication code
   * 
   * Creates one-time authentication code and associates it with authentication result.
   * 
   * @param authResult - Authentication result from OAuth flow
   * @returns Generated authentication code
   */
  generateAndStore(authResult: AuthResult): string {
    // Generate cryptographically secure authentication code
    const authCode = generateAuthCode();

    // Store auth result with code
    this.codeStore.store(authCode, authResult);

    return authCode;
  }

  /**
   * Exchange authentication code for authentication result
   * 
   * Single-use operation: code is consumed and cannot be reused.
   * 
   * @param authCode - Authentication code to exchange
   * @returns Authentication result
   * @throws AuthCodeServiceError if code invalid, expired, or already consumed
   */
  exchange(authCode: string): AuthResult {
    // Clean expired entries before exchange
    this.codeStore.cleanExpired();

    // Consume code (single-use)
    const authResult = this.codeStore.consume(authCode);

    if (!authResult) {
      // Code does not exist, already consumed, or expired
      throw new AuthCodeServiceError(
        AuthErrorCode.INVALID_AUTH_CODE,
        'Invalid or expired authentication code',
      );
    }

    return authResult;
  }

  /**
   * Clean expired codes
   * 
   * Can be called explicitly for maintenance.
   * Also called automatically during exchange.
   * 
   * @returns Number of codes removed
   */
  cleanExpiredCodes(): number {
    return this.codeStore.cleanExpired();
  }
}

