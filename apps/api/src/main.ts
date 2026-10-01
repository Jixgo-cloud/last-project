import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Increase payload limit for profile logo and verification document attachments
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  app.setGlobalPrefix('api');

  // Fail-Closed CORS Configuration
  const isDevelopment = process.env.NODE_ENV === 'development';
  const frontendUrl = process.env.FRONTEND_URL;
  const extraOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const allowedOrigins = [
    frontendUrl,
    ...extraOrigins,
    ...(isDevelopment ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []),
  ].filter(Boolean) as string[];

  if (allowedOrigins.includes('*')) {
    throw new Error('Wildcard CORS origin (*) is strictly forbidden when credentials=true.');
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      // or explicitly configured origins or any Vercel deployment (*.vercel.app)
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https:\/\/.*\.vercel\.app$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  });

  // Strict Request Hardening: reject unknown fields with 400 Bad Request
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 SmartCareer Backend API is running on: http://localhost:${port}/api`);
}

bootstrap();

