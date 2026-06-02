import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SafetyModule } from '../safety/safety.module';
import { PodsController } from './pods.controller';
import { PodsService } from './pods.service';

@Module({
  imports: [AuthModule, SafetyModule],
  controllers: [PodsController],
  providers: [PodsService],
  exports: [PodsService],
})
export class PodsModule {}
