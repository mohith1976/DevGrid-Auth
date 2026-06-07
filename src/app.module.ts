/**
 * App Module
 * 
 * Root module for the NestJS application.
 * Imports and configures all feature modules.
 */

import { Module } from '@nestjs/common';
import { HealthController } from './routes/health.controller.js';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
