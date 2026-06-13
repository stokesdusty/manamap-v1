import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/config.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventRemindersService } from './event-reminders.service';
import { EventRemindersProcessor } from './event-reminders.processor';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueueAsync({
      name: 'event-reminders',
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env>) => ({
        connection: {
          url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        },
      }),
    }),
  ],
  providers: [EventRemindersService, EventRemindersProcessor],
  exports: [EventRemindersService],
})
export class EventRemindersModule {}
