import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PresenceModule } from '../presence/presence.module';
import { GamificationModule } from '../gamification/gamification.module';
import { EventRemindersModule } from '../event-reminders/event-reminders.module';
import { SafetyModule } from '../safety/safety.module';
import { QuestsModule } from '../quests/quests.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [AuthModule, PresenceModule, GamificationModule, EventRemindersModule, SafetyModule, QuestsModule],
  controllers: [StoresController],
  providers: [StoresService],
})
export class StoresModule {}
