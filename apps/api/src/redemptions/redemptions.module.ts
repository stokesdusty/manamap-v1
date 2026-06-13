import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RedemptionsController } from './redemptions.controller';
import { RedemptionsService } from './redemptions.service';

@Module({
  imports: [AuthModule],
  controllers: [RedemptionsController],
  providers: [RedemptionsService],
  exports: [RedemptionsService],
})
export class RedemptionsModule {}
