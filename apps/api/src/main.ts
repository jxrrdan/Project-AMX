import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app/app.module';

/** Applies the same CORS allow-list to Socket.IO as to the REST API. */
class CorsIoAdapter extends IoAdapter {
  constructor(app: NestExpressApplication, private readonly origin: string) {
    super(app);
  }
  override createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, { ...options, cors: { origin: this.origin, credentials: true } });
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Behind ALB/CloudFront the socket IP is the proxy's; trust it so rate limits key on the real client.
  if (config.get<string>('TRUST_PROXY')) {
    app.set('trust proxy', config.get<string>('TRUST_PROXY') === 'true' ? 1 : config.get<string>('TRUST_PROXY'));
  }
  app.useWebSocketAdapter(new CorsIoAdapter(app, config.get<string>('CORS_ORIGIN', 'http://localhost:4200')));
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
