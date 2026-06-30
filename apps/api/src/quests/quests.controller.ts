import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { QuestsService } from './quests.service';

@Controller('v1/quests')
@UseGuards(AuthGuard)
export class QuestsController {
  constructor(private readonly quests: QuestsService) {}

  @Get()
  list(@Request() req: { user: { sub: string } }) {
    return this.quests.getActiveQuests(req.user.sub);
  }
}
