import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PresenceModule } from '../presence/presence.module';
import { GamificationModule } from '../gamification/gamification.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [AuthModule, PresenceModule, GamificationModule],
  controllers: [StoresController],
  providers: [StoresService],
})
export class StoresModule {}
