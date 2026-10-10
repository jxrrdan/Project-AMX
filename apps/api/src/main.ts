import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { validateProductionConfig } from './common/config/production-config';
import { resolveDatabaseUrl } from './common/config/runtime-env';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

/**
 * Applies the same CORS allow-list to Socket.IO as to the REST API and, when REDIS_URL is set,
 * fans events out through Redis pub/sub. Without it each ECS task only reaches its own sockets, so
 * with 2+ tasks a job-card change made on one task would never reach a user connected to another.
 */
class CorsIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: NestExpressApplication, private readonly origin: string) {
    super(app);
  }

  async connectToRedis(url: string): Promise<void> {
    const pub = createClient({ url });
    const sub = pub.duplicate();
    pub.on('error', (err) => Logger.error(`Redis pub error: ${err.message}`));
    sub.on('error', (err) => Logger.error(`Redis sub error: ${err.message}`));
    await Promise.all([pub.connect(), sub.connect()]);
    this.adapterConstructor = createAdapter(pub, sub);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, { ...options, cors: { origin: this.origin, credentials: true } });
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}

async function bootstrap() {
  resolveDatabaseUrl(process.env);
  const configProblems = validateProductionConfig(process.env);
  if (configProblems.length > 0) {
    Logger.error(`Refusing to start with unsafe production configuration:\n - ${configProblems.join('\n - ')}`);
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Behind ALB/CloudFront the socket IP is the proxy's; trust it so rate limits key on the real client.
  const trustProxy = config.get<string>('TRUST_PROXY');
  if (trustProxy) {
    // "true" = one hop; a number = that many hops (CloudFront + ALB = 2); anything else is a CIDR list.
    app.set('trust proxy', trustProxy === 'true' ? 1 : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }
  const ioAdapter = new CorsIoAdapter(app, config.get<string>('CORS_ORIGIN', 'http://localhost:4200'));
  const redisUrl = config.get<string>('REDIS_URL');
  if (redisUrl) {
    await ioAdapter.connectToRedis(redisUrl);
  }
  app.useWebSocketAdapter(ioAdapter);
  app.enableShutdownHooks(); // drain in-flight requests and close DB/sockets on ECS SIGTERM
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', 'http://localhost:4200'), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  // Local stand-in for S3: files saved by StorageService are served back from disk.
  if (config.get<string>('STORAGE_DRIVER', 'local') === 'local') {
    app.useStaticAssets(config.get<string>('STORAGE_LOCAL_PATH', './.data/storage'), {
      prefix: '/storage',
    });
  }

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port);
  Logger.log(`🚀 AMS API running on http://localhost:${port}/api`);
}

bootstrap();
