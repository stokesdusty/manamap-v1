import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminModerationController } from './admin-moderation.controller';
import { AdminModerationService } from './admin-moderation.service';
import { AdminStoresController } from './admin-stores.controller';
import { AdminStoresService } from './admin-stores.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [AdminModerationController, AdminStoresController],
  providers: [AdminModerationService, AdminStoresService, RolesGuard],
})
export class AdminModerationModule {}
