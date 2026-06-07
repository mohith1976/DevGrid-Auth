/**
 * Auth Controller
 * 
 * Handles OAuth authentication endpoints.
 * Per API_CONTRACT.md, provides authentication flow endpoints.
 */

import { Controller, Get, Query, Redirect, HttpException, HttpStatus } from '@nestjs/common';
import { OAuthService, OAuthServiceError } from '../services/oauth/oauth.service.js';
import type { AuthResult } from '../domain/auth/models.js';
import { AuthErrorCode } from '../domain/auth/errors.js';

/**
 * Auth Controller
 * 
 * OAuth authentication endpoints.
 * 
 * Responsibilities:
 * - Receive HTTP requests
 * - Call service methods
 * - Return HTTP responses
 * 
 * No business logic. No configuration assembly. No OAuth details.
 */
@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly oauthService: OAuthService) {}

  /**
   * GET /api/v1/auth/login
   * 
   * Initiates GitHub OAuth authentication flow.
   * Per AUTH_FLOW.md Steps 4-5.
   * 
   * Flow:
   * 1. Service generates secure OAuth state
   * 2. Service stores state for callback validation
   * 3. Service generates GitHub authorization URL
   * 4. Redirect user to GitHub
   * 
   * @returns HTTP 302 redirect to GitHub OAuth authorization page
   */
  @Get('login')
  @Redirect()
  login(): { url: string } {
    // Delegate to service (configuration assembled by service)
    const { authorizationUrl } = this.oauthService.generateAuthorizationRequest('repo user');

    // Return redirect response
    return { url: authorizationUrl };
  }

  /**
   * GET /api/v1/auth/callback
   * 
   * Handles GitHub OAuth callback.
   * Per AUTH_FLOW.md Steps 8-11.
   * 
   * Flow:
   * 1. Validate state parameter (CSRF protection)
   * 2. Consume state (prevent replay)
   * 3. Exchange authorization code for token
   * 4. Retrieve authenticated user from GitHub
   * 5. Return authentication result
   * 
   * @param code - Authorization code from GitHub
   * @param state - State parameter for validation
   * @returns Authentication result (user + token + session)
   * @throws HttpException if callback processing fails
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
  ): Promise<{ success: true; data: AuthResult }> {
    // Validate required parameters
    if (!code || !state) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: AuthErrorCode.INVALID_REQUEST,
            message: 'Missing required parameters: code and state',
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Delegate to service (all OAuth logic handled by service)
      const authResult = await this.oauthService.handleCallback(code, state);

      // Return success response
      return {
        success: true,
        data: authResult,
      };
    } catch (error) {
      if (error instanceof OAuthServiceError) {
        // Map service errors to HTTP responses
        const statusCode = this.getStatusCodeForError(error.code);

        throw new HttpException(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          },
          statusCode,
        );
      }

      // Unexpected error
      throw new HttpException(
        {
          success: false,
          error: {
            code: AuthErrorCode.AUTHENTICATION_FAILED,
            message: 'Authentication failed',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Map error codes to HTTP status codes
   * 
   * @param code - Auth error code
   * @returns HTTP status code
   */
  private getStatusCodeForError(code: AuthErrorCode): HttpStatus {
    switch (code) {
      case AuthErrorCode.INVALID_STATE:
      case AuthErrorCode.INVALID_REQUEST:
        return HttpStatus.BAD_REQUEST;

      case AuthErrorCode.UNAUTHORIZED:
      case AuthErrorCode.ACCESS_DENIED:
        return HttpStatus.UNAUTHORIZED;

      case AuthErrorCode.TOKEN_EXCHANGE_FAILED:
      case AuthErrorCode.AUTHENTICATION_FAILED:
        return HttpStatus.UNAUTHORIZED;

      case AuthErrorCode.GITHUB_UNAVAILABLE:
        return HttpStatus.SERVICE_UNAVAILABLE;

      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
