import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SafetyModule } from '../safety/safety.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LfgController } from './lfg.controller';
import { LfgService } from './lfg.service';

@Module({
  imports: [AuthModule, SafetyModule, NotificationsModule],
  controllers: [LfgController],
  providers: [LfgService],
  exports: [LfgService],
})
export class LfgModule {}
