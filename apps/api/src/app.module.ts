import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/config.schema';
import { AuthModule } from './auth/auth.module';
import { GamificationModule } from './gamification/gamification.module';
import { ConnectionsModule } from './connections/connections.module';
import { EncountersModule } from './encounters/encounters.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { ExchangeModule } from './exchange/exchange.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { PresenceModule } from './presence/presence.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StoresModule } from './stores/stores.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    GamificationModule,
    HealthModule,
    MeModule,
    ExchangeModule,
    ConnectionsModule,
    EncountersModule,
    PresenceModule,
    DiscoveryModule,
    StoresModule,
  ],
})
export class AppModule {}
