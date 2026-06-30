import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EndorsementsModule } from '../endorsements/endorsements.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [AuthModule, EndorsementsModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
