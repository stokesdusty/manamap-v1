import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminModerationController } from './admin-moderation.controller';
import { AdminModerationService } from './admin-moderation.service';
import { AdminStoresController } from './admin-stores.controller';
import { AdminStoresService } from './admin-stores.service';
import { AdminStoreClaimsController } from './admin-store-claims.controller';
import { AdminStoreClaimsService } from './admin-store-claims.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [AdminModerationController, AdminStoresController, AdminStoreClaimsController],
  providers: [AdminModerationService, AdminStoresService, AdminStoreClaimsService, RolesGuard],
})
export class AdminModerationModule {}
