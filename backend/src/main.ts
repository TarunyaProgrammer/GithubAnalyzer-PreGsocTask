import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
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
    '/webhooks',
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

  // CORS for Angular frontend
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow localhost for development and any vercel.app subdomain for production
      const allowedPatterns = [/^http:\/\/localhost:\d+$/, /\.vercel\.app$/];

      if (!origin || allowedPatterns.some((pattern) => pattern.test(origin))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  const port = process.env['PORT'] || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 WebiU Backend running on http://localhost:${port}`);
}

void bootstrap();
