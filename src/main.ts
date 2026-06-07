/**
 * DevGrid Authentication Service - NestJS Bootstrap
 * 
 * Foundational authentication infrastructure for DevGrid.
 * This service provides:
 * - Configuration management
 * - Health monitoring
 * - Foundation for OAuth implementation
 * 
 * No authentication functionality is implemented yet.
 * OAuth flows will be added in Phase 4B.
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { initializeConfig } from './config/index.js';

/**
 * Bootstrap the NestJS application
 */
async function bootstrap(): Promise<void> {
  try {
    // Load and validate configuration
    console.log('Initializing configuration...');
    const config = initializeConfig();
    console.log(`Configuration loaded successfully for environment: ${config.nodeEnv}`);

    // Create NestJS application
    const app = await NestFactory.create(AppModule);

    // Start application
    await app.listen(config.port);
    console.log(`DevGrid Authentication Service started on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Health check available at: http://localhost:${config.port}/api/v1/health`);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Startup failed:', error.message);
    } else {
      console.error('Startup failed with unknown error:', error);
    }
    process.exit(1);
  }
}

bootstrap();
