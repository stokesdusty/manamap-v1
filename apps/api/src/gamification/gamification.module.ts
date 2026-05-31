import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/config.schema';
import { GamificationService } from './gamification.service';
import { LeaderboardProcessor } from './leaderboard.processor';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'gamification',
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env>) => ({
        connection: {
          url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        },
      }),
    }),
  ],
  providers: [GamificationService, LeaderboardProcessor],
  exports: [GamificationService],
})
export class GamificationModule {}
