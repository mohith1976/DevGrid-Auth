/**
 * App Module
 * 
 * Root module for the NestJS application.
 * Imports and configures all feature modules.
 */

import { Module } from '@nestjs/common';
import { HealthController } from './routes/health.controller.js';
import { AuthController } from './routes/auth.controller.js';
import { OAuthService } from './services/oauth/oauth.service.js';
import { AuthCodeService } from './services/auth-code/auth-code.service.js';

@Module({
  imports: [],
  controllers: [HealthController, AuthController],
  providers: [OAuthService, AuthCodeService],
})
export class AppModule {}
