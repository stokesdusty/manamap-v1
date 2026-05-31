import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';

@Module({
  imports: [AuthModule],
  controllers: [EncountersController],
  providers: [EncountersService],
})
export class EncountersModule {}
