/**
 * Authentication Error Contracts
 * 
 * Strongly typed authentication error codes and error structure.
 */

/**
 * Auth Error Codes
 * 
 * Domain-level authentication failure codes.
 * Represents business logic failures in authentication workflows.
 */
export enum AuthErrorCode {
  // OAuth Flow Errors
  INVALID_STATE = 'INVALID_STATE',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TOKEN_EXCHANGE_FAILED = 'TOKEN_EXCHANGE_FAILED',

  // Session Errors
  SESSION_INVALID = 'SESSION_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',

  // Authorization Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  ACCESS_DENIED = 'ACCESS_DENIED',

  // Request Errors
  INVALID_REQUEST = 'INVALID_REQUEST',

  // External Service Errors
  GITHUB_UNAVAILABLE = 'GITHUB_UNAVAILABLE',
}

/**
 * Auth Error
 * 
 * Represents authentication failure with structured error information.
 */
export interface AuthError {
  /** Error code */
  readonly code: AuthErrorCode;

  /** Human-readable error message */
  readonly message: string;

  /** Additional error details (optional) */
  readonly details?: Record<string, unknown>;
}
