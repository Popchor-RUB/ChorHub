import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaService } from './prisma/prisma.service';

const DEV_LOG_LEVELS: ('log' | 'error' | 'warn' | 'debug' | 'verbose')[] = [
  'log',
  'error',
  'warn',
  'debug',
  'verbose',
];

const MAX_LOG_BODY_LENGTH = 10_000;

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

function formatBodyForLog(body: unknown): string {
  if (body === undefined || body === null) return '';

  let serialized: string;
  if (typeof body === 'string') {
    serialized = body;
  } else if (Buffer.isBuffer(body)) {
    serialized = body.toString('utf8');
  } else {
    try {
      serialized = JSON.stringify(body);
    } catch {
      serialized = '[unserializable body]';
    }
  }

  if (serialized.length > MAX_LOG_BODY_LENGTH) {
    return `${serialized.slice(0, MAX_LOG_BODY_LENGTH)}...[truncated]`;
  }

  return serialized;
}

async function bootstrap() {
  const debugLoggingEnabled = process.env.ENABLE_DEBUG_LOGGING === '1';
  const app = await NestFactory.create(AppModule, {
    logger: debugLoggingEnabled ? DEV_LOG_LEVELS : undefined,
  });
  const httpLogger = new Logger('HTTP');

  if (debugLoggingEnabled) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const startedAt = process.hrtime.bigint();
      const requestPath = req.originalUrl ?? req.url;
      const requestBody = formatBodyForLog(req.body);
      let responseBody = '';

      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = ((body: unknown) => {
        responseBody = formatBodyForLog(body);
        return originalJson(body);
      }) as Response['json'];

      res.send = ((body: unknown) => {
        responseBody = formatBodyForLog(body);
        return originalSend(body);
      }) as Response['send'];

      const requestSuffix = requestBody ? ` body=${requestBody}` : '';
      httpLogger.debug(`--> ${req.method} ${requestPath}${requestSuffix}`);

      res.on('finish', () => {
        const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const responseSuffix = responseBody ? ` body=${responseBody}` : '';
        httpLogger.debug(`<-- ${req.method} ${requestPath} ${res.statusCode} ${elapsedMs.toFixed(1)}ms${responseSuffix}`);
      });

      next();
    });
  }

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const appOrigin = normalizeOrigin(process.env.APP_URL ?? 'http://localhost:5173');
  const extraOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));
  const allowedOrigins = Array.from(new Set([appOrigin, ...extraOrigins].filter(Boolean)));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '0.0.0.0');

  const prisma = app.get(PrismaService);
  const adminCount = await prisma.adminUser.count();
  if (adminCount === 0) {
    const logger = new Logger('Bootstrap');
    const providedHash = process.env.INITIAL_ADMIN_PASSWORD_HASH;
    let passwordHash: string;
    let generatedPassword: string | null = null;

    if (providedHash) {
      passwordHash = providedHash;
    } else {
      generatedPassword = randomBytes(12).toString('base64url');
      passwordHash = await bcrypt.hash(generatedPassword, 10);
    }

    await prisma.adminUser.create({ data: { username: 'admin', passwordHash } });
    logger.log('════════════════════════════════════════');
    logger.log('  INITIAL ADMIN ACCOUNT CREATED');
    logger.log('  Username : admin');
    if (generatedPassword) {
      logger.log(`  Password : ${generatedPassword}`);
      logger.log('  Change this password after first login!');
    } else {
      logger.log('  Password : (set via INITIAL_ADMIN_PASSWORD_HASH)');
    }
    logger.log('════════════════════════════════════════');
  }
}
void bootstrap();
