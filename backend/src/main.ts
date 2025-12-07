import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import { AppModule } from './app.module';
import { initLanguageQueue } from './queues/languageQueue';
import { ProjectsService } from './projects/projects.service';
import { ProposalsService } from './projects/proposals.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Allow frontend origin. In development allow any origin to support varying Vite ports.
  const isProd = process.env.NODE_ENV === 'production';
  const corsOrigin = isProd ? (process.env.FRONTEND_URL || 'http://localhost:5173') : true;
  app.enableCors({ origin: corsOrigin, credentials: true });
  const port = process.env.PORT || 3000;
  // serve uploads folder for media proof files
  const uploadsFolder = require('path').join(process.cwd(), 'backend', 'uploads');
  try {
    app.use('/uploads', express.static(uploadsFolder));
  } catch (e) {
    console.warn('Failed to register uploads static middleware', (e as any)?.message || e);
  }
  await app.listen(port);
  console.log(`Backend listening on http://localhost:${port}`);

  // Initialize the background language queue (worker). Provide ProjectsService instance so
  // worker can call into service methods that update profiles.
  try {
    const projectsSvc = app.get(ProjectsService);
    initLanguageQueue(projectsSvc);
    console.log('Language aggregation queue initialized');
  } catch (e) {
    console.warn('Failed to initialize language queue', (e as any)?.message || e);
  }
  // Run proposals cleanup on startup and schedule daily cleanup
  try {
    const proposalsSvc = app.get(ProposalsService);
    // initial cleanup
    proposalsSvc.cleanupOldApplications().catch((err:any)=>console.warn('cleanupOldApplications failed', (err as any)?.message || err));
    proposalsSvc.cleanupStaleProposals().catch((err:any)=>console.warn('cleanupStaleProposals failed', (err as any)?.message || err));
    // schedule daily cleanup (every 24h)
    setInterval(() => {
      proposalsSvc.cleanupOldApplications().catch((err:any)=>console.warn('cleanupOldApplications failed', (err as any)?.message || err));
      proposalsSvc.cleanupStaleProposals().catch((err:any)=>console.warn('cleanupStaleProposals failed', (err as any)?.message || err));
    }, 24 * 60 * 60 * 1000);
    console.log('Proposals cleanup scheduled');
  } catch (e) {
    console.warn('Failed to schedule proposals cleanup', (e as any)?.message || e);
  }
}

bootstrap();
