import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { HeartbeatBodySchema, type HeartbeatBody } from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { PresenceService } from './presence.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller()
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Post('v1/presence/heartbeat')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  heartbeat(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(HeartbeatBodySchema)) body: HeartbeatBody,
  ) {
    return this.presence.heartbeat(req.user.sub, body.storeId);
  }
}
