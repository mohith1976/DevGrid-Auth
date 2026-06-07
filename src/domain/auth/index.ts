/**
 * Authentication Domain Public Exports
 * 
 * Clean public API for authentication contracts and interfaces.
 * Consumers should import from: import { X } from '@/domain/auth'
 */

// Domain Models
export type {
  AuthenticatedUser,
  OAuthToken,
  OAuthState,
  AuthSession,
  AuthResult,
} from './models.js';

// Error Contracts
export type { AuthError } from './errors.js';
export { AuthErrorCode } from './errors.js';

// Service Interfaces
export type {
  IOAuthProvider,
  IAuthService,
  ISessionService,
  ITokenService,
} from './interfaces.js';
