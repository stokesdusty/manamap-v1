import 'reflect-metadata';
import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import type { Http2ServerRequest } from 'http2';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import { WsAdapter } from './ws-adapter';
import { Logger } from 'nestjs-pino';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { envSchema } from './config/config.schema';

async function bootstrap(): Promise<void> {
  const env = envSchema.parse(process.env);

  if (env.SENTRY_DSN) {
    Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
  }

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception', err);
    if (env.SENTRY_DSN) Sentry.captureException(err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection', reason);
    if (env.SENTRY_DSN) {
      Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
    }
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      trustProxy: true,
      genReqId: (req: IncomingMessage | Http2ServerRequest) => {
        const incoming = req.headers['x-request-id'];
        if (Array.isArray(incoming)) return incoming[0] ?? randomUUID();
        return (incoming as string | undefined) ?? randomUUID();
      },
    }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));
  app.useWebSocketAdapter(new WsAdapter(app));

  await app.register(helmet, {
    contentSecurityPolicy: false,     // API returns JSON, not HTML
    crossOriginEmbedderPolicy: false, // would block cross-origin WS/fetch from mobile
  });

  // Echo request ID back so clients can correlate errors in logs
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  fastify.addHook('onSend', (req, reply, _payload, done) => {
    reply.header('x-request-id', String(req.id));
    done();
  });

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: (process.env['CORS_ORIGIN'] ?? 'http://localhost:5173,http://localhost:4173')
      .split(',')
      .map((s) => s.trim()),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(env.API_PORT, env.API_HOST);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
