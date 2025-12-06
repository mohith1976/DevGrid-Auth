import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { initLanguageQueue } from './queues/languageQueue';
import { ProjectsService } from './projects/projects.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Allow frontend origin. In development allow any origin to support varying Vite ports.
  const isProd = process.env.NODE_ENV === 'production';
  const corsOrigin = isProd ? (process.env.FRONTEND_URL || 'http://localhost:5173') : true;
  app.enableCors({ origin: corsOrigin, credentials: true });
  const port = process.env.PORT || 3000;
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
}

bootstrap();
