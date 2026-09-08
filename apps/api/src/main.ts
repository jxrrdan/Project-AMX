import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', 'http://localhost:4200'), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  // Local stand-in for S3: files saved by StorageService are served back from disk.
  app.useStaticAssets(config.get<string>('STORAGE_LOCAL_PATH', './.data/storage'), {
    prefix: '/storage',
  });

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port);
  Logger.log(`🚀 AMS API running on http://localhost:${port}/api`);
}

bootstrap();
