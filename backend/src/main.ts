import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: process.env.APP_URL ?? 'http://localhost:5173',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);

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
bootstrap();
