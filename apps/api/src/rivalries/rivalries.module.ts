import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SafetyModule } from '../safety/safety.module';
import { RivalriesController } from './rivalries.controller';
import { RivalriesService } from './rivalries.service';

@Module({
  imports: [AuthModule, SafetyModule],
  controllers: [RivalriesController],
  providers: [RivalriesService],
})
export class RivalriesModule {}
