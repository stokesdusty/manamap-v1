import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PresenceModule } from '../presence/presence.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [AuthModule, PresenceModule],
  controllers: [StoresController],
  providers: [StoresService],
})
export class StoresModule {}
