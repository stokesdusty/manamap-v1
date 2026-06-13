import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SocialsController } from './socials.controller';
import { SocialsService } from './socials.service';

@Module({
  imports: [AuthModule],
  controllers: [SocialsController],
  providers: [SocialsService],
  exports: [SocialsService],
})
export class SocialsModule {}
