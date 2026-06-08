import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LifeTrackerGateway } from './life-tracker.gateway';
import { LifeTrackerService } from './life-tracker.service';

@Module({
  imports: [AuthModule],
  providers: [LifeTrackerGateway, LifeTrackerService],
})
export class LifeTrackerModule {}
