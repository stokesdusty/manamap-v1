import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import type { PlayOnlineService } from './play-online.service';
import { PlayOnlineInviteSchema, type PlayOnlineInvite } from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/play-online')
@UseGuards(AuthGuard)
export class PlayOnlineController {
  constructor(private readonly service: PlayOnlineService) {}

  @Post('invite')
  @HttpCode(200)
  invite(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(PlayOnlineInviteSchema)) body: PlayOnlineInvite,
  ) {
    return this.service.sendInvites(req.user.sub, body.platform, body.roomLink, body.connectionIds);
  }
}
