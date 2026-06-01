import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminModerationController } from './admin-moderation.controller';
import { AdminModerationService } from './admin-moderation.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminModerationController],
  providers: [AdminModerationService, RolesGuard],
})
export class AdminModerationModule {}
