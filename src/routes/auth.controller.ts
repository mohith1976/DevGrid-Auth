/**
 * Auth Controller
 * 
 * Handles OAuth authentication endpoints.
 * Per API_CONTRACT.md, provides authentication flow endpoints.
 */

import { Controller, Get, Post, Query, Body, Redirect, HttpException, HttpStatus } from '@nestjs/common';
import { OAuthService, OAuthServiceError } from '../services/oauth/oauth.service.js';
import { AuthCodeService, AuthCodeServiceError } from '../services/auth-code/auth-code.service.js';
import type { AuthResult } from '../domain/auth/models.js';
import { AuthErrorCode } from '../domain/auth/errors.js';
import { getConfig } from '../config/index.js';

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
  constructor(
    private readonly oauthService: OAuthService,
    private readonly authCodeService: AuthCodeService,
  ) {}

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
   * Per AUTH_FLOW.md Steps 8-12.
   * 
   * Flow:
   * 1. Validate state parameter (CSRF protection)
   * 2. Exchange authorization code for token
   * 3. Retrieve authenticated user from GitHub
   * 4. Generate one-time authentication code
   * 5. Store authentication result
   * 6. Consume OAuth state
   * 7. Redirect to extension with authentication code
   * 
   * @param code - Authorization code from GitHub
   * @param state - State parameter for validation
   * @returns HTTP 302 redirect to extension callback page with auth code
   * @throws HttpException if callback processing fails
   */
  @Get('callback')
  @Redirect()
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
  ): Promise<{ url: string }> {
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
      // Returns authentication code (not full AuthResult)
      const authCode = await this.oauthService.handleCallback(code, state);

      // Build extension callback URL with authentication code
      const config = getConfig();
      const extensionCallbackUrl = this.buildExtensionCallbackUrl(
        config.extension.callbackUrl,
        authCode,
      );

      // Redirect to extension callback page
      return { url: extensionCallbackUrl };
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
   * POST /api/v1/auth/exchange
   * 
   * Exchange one-time authentication code for authentication result.
   * Per AUTH_FLOW.md Step 13.
   * 
   * Flow:
   * 1. Validate request body
   * 2. Clean expired authentication codes
   * 3. Consume authentication code (single-use)
   * 4. Return authentication result
   * 
   * @param body - Request body containing authCode
   * @returns Authentication result (user + token)
   * @throws HttpException if exchange fails
   */
  @Post('exchange')
  async exchange(
    @Body() body: { authCode?: string },
  ): Promise<{ success: true; data: AuthResult }> {
    // Validate request body
    if (!body.authCode) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: AuthErrorCode.INVALID_REQUEST,
            message: 'Missing required field: authCode',
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Exchange authentication code for result (single-use)
      const authResult = this.authCodeService.exchange(body.authCode);

      // Return success response
      return {
        success: true,
        data: authResult,
      };
    } catch (error) {
      if (error instanceof AuthCodeServiceError) {
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
            message: 'Authentication code exchange failed',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Build extension callback URL with authentication code
   * 
   * @param baseUrl - Base extension callback URL from configuration
   * @param authCode - One-time authentication code
   * @returns Complete extension callback URL
   */
  private buildExtensionCallbackUrl(baseUrl: string, authCode: string): string {
    // Append authentication code as query parameter
    // Only auth code in URL - no OAuth tokens, no user data
    const url = new URL(baseUrl);
    url.searchParams.set('code', authCode);
    return url.toString();
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
      case AuthErrorCode.INVALID_AUTH_CODE:
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
