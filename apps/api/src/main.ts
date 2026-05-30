import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { envSchema } from './config/config.schema';

async function bootstrap(): Promise<void> {
  const env = envSchema.parse(process.env);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: env.NODE_ENV !== 'production' }),
  );

  app.setGlobalPrefix('api');

  await app.listen(env.API_PORT, env.API_HOST);
  console.log(`API listening on http://${env.API_HOST}:${env.API_PORT}/api`);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
