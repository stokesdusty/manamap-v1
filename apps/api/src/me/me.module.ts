import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EndorsementsModule } from '../endorsements/endorsements.module';
import { EventRemindersModule } from '../event-reminders/event-reminders.module';
import { PresenceModule } from '../presence/presence.module';
import { LfgModule } from '../lfg/lfg.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [AuthModule, EndorsementsModule, EventRemindersModule, PresenceModule, LfgModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
