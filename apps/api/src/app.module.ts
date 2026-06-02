import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { validate } from './config/config.schema';
import { AuthModule } from './auth/auth.module';
import { ThrottleModule } from './throttle/throttle.module';
import { ThrottleGuard } from './throttle/throttle.guard';
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
import { PartnerModule } from './partner/partner.module';
import { SafetyModule } from './safety/safety.module';
import { AdminModerationModule } from './admin-moderation/admin-moderation.module';
import { LfgModule } from './lfg/lfg.module';
import { PodsModule } from './pods/pods.module';
import { GamesModule } from './games/games.module';
import { DevModule } from './dev/dev.module';

const devEnabled =
  process.env['NODE_ENV'] !== 'production' && process.env['DEV_TOOLS'] === 'true';

const conditionalModules: Array<DynamicModule | typeof DevModule> = devEnabled ? [DevModule] : [];

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
    PartnerModule,
    SafetyModule,
    AdminModerationModule,
    LfgModule,
    PodsModule,
    GamesModule,
    ThrottleModule,
    ...conditionalModules,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottleGuard }],
})
export class AppModule {}
