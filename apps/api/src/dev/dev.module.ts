import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PresenceModule } from '../presence/presence.module';
import { LfgModule } from '../lfg/lfg.module';
import { PodsModule } from '../pods/pods.module';
import { ConnectionsModule } from '../connections/connections.module';
import { GamesModule } from '../games/games.module';
import { DevController } from './dev.controller';
import { DevService } from './dev.service';

@Module({
  imports: [AuthModule, PresenceModule, LfgModule, PodsModule, ConnectionsModule, GamesModule],
  controllers: [DevController],
  providers: [DevService],
})
export class DevModule {}
