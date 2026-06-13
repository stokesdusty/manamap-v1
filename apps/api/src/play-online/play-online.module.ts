import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlayOnlineController } from './play-online.controller';
import { PlayOnlineService } from './play-online.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [PlayOnlineController],
  providers: [PlayOnlineService],
})
export class PlayOnlineModule {}
