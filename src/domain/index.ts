/**
 * Domain Layer Public Exports
 * 
 * Top-level domain exports for authentication subdomain.
 */

export type {
  AuthenticatedUser,
  OAuthToken,
  OAuthState,
  AuthSession,
  AuthResult,
  AuthError,
  IOAuthProvider,
  IAuthService,
  ISessionService,
  ITokenService,
} from './auth/index.js';

export { AuthErrorCode } from './auth/index.js';
