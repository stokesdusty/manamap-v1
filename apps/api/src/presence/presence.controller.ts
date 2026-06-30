import { Body, Controller, Delete, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { HeartbeatBodySchema, type HeartbeatBody } from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import type { PresenceService } from './presence.service';

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
    return this.presence.heartbeat(req.user.sub, body);
  }

  @Delete('v1/presence/checkin')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  checkout(@Req() req: AuthRequest) {
    return this.presence.checkout(req.user.sub);
  }
}
