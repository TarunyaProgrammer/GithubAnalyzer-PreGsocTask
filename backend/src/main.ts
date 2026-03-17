import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters';
import * as bodyParser from 'body-parser';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    // Disable default body parser so we can capture raw body for webhook signature validation
    bodyParser: false,
  });

  // Raw body parser for webhook routes (needed for HMAC-SHA256 signature validation)
  app.use(
    '/api/webhooks',
    bodyParser.json({
      verify: (
        req: import('http').IncomingMessage,
        _res: import('http').ServerResponse,
        buf: Buffer,
      ) => {
        (req as unknown as { rawBody: Buffer }).rawBody = buf;
      },
    }),
  );

  // Standard JSON parser for all other routes
  app.use(bodyParser.json());

  // Simple request logging middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.log(
      `Incoming Request: ${req.method} ${req.url} - Origin: ${req.get('origin') || 'None'}`,
    );
    next();
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // CORS - Allow all origins temporarily for debugging
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  const port = process.env['PORT'] || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 RepoArg Backend running on http://localhost:${port}`);
}

void bootstrap();
