import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SafetyModule } from '../safety/safety.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuestsModule } from '../quests/quests.module';
import { SocialsModule } from '../socials/socials.module';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';

@Module({
  imports: [AuthModule, SafetyModule, NotificationsModule, QuestsModule, SocialsModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
