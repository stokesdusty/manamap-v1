import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SafetyModule } from '../safety/safety.module';
import { EndorsementsController } from './endorsements.controller';
import { EndorsementsService } from './endorsements.service';

@Module({
  imports: [AuthModule, SafetyModule],
  controllers: [EndorsementsController],
  providers: [EndorsementsService],
  exports: [EndorsementsService],
})
export class EndorsementsModule {}
