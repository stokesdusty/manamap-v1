import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { validate } from './config/config.schema';
import type { Env } from './config/config.schema';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
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
import { EndorsementsModule } from './endorsements/endorsements.module';
import { DevModule } from './dev/dev.module';
import { RedemptionsModule } from './redemptions/redemptions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QuestsModule } from './quests/quests.module';
import { RivalriesModule } from './rivalries/rivalries.module';
import { SocialsModule } from './socials/socials.module';
import { LifeTrackerModule } from './life-tracker/life-tracker.module';
import { PlayOnlineModule } from './play-online/play-online.module';

const devEnabled = process.env['NODE_ENV'] !== 'production' && process.env['DEV_TOOLS'] === 'true';

const conditionalModules: Array<DynamicModule | typeof DevModule> = devEnabled ? [DevModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env>) => {
        const isDev = config.get<string>('NODE_ENV') !== 'production';
        const level = config.get<string>('LOG_LEVEL') ?? (isDev ? 'debug' : 'info');
        return {
          pinoHttp: {
            level,
            ...(isDev
              ? {
                  transport: {
                    target: 'pino-pretty',
                    options: {
                      colorize: true,
                      translateTime: 'SYS:standard',
                      ignore: 'pid,hostname',
                    },
                  },
                }
              : {}),
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
          },
        };
      },
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
    EndorsementsModule,
    RedemptionsModule,
    NotificationsModule,
    QuestsModule,
    RivalriesModule,
    SocialsModule,
    LifeTrackerModule,
    PlayOnlineModule,
    ThrottleModule,
    ...conditionalModules,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottleGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
