import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventRemindersModule } from '../event-reminders/event-reminders.module';
import { RedemptionsModule } from '../redemptions/redemptions.module';
import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';
import { BroadcastService } from './broadcast.service';

@Module({
  imports: [AuthModule, EventRemindersModule, RedemptionsModule],
  controllers: [PartnerController],
  providers: [PartnerService, BroadcastService],
  exports: [PartnerService],
})
export class PartnerModule {}
