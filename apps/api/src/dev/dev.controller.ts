import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { DevService } from './dev.service';

type AuthRequest = { user: AccessTokenPayload };

const PopulateStoreSchema = z.object({
  storeId: z.string().optional(),
  count: z.number().int().min(1).max(8).default(4),
});

const StoreOptionalSchema = z.object({
  storeId: z.string().optional(),
});

const RequestMeSchema = z.object({
  botId: z.string().optional(),
});

const LogGameSchema = z.object({
  winnerId: z.string().optional(),
});

const PodForTrackerSchema = z.object({
  seats: z.number().int().min(2).max(4).default(4),
});

@Controller('v1/dev')
@UseGuards(AuthGuard)
export class DevController {
  constructor(private readonly dev: DevService) {}

  @Post('populate-store')
  @HttpCode(200)
  populateStore(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(PopulateStoreSchema))
    body: z.infer<typeof PopulateStoreSchema>,
  ) {
    return this.dev.populateStore(req.user.sub, body.storeId, body.count);
  }

  @Post('host-pod')
  @HttpCode(200)
  hostPod(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(StoreOptionalSchema))
    body: z.infer<typeof StoreOptionalSchema>,
  ) {
    return this.dev.hostPod(req.user.sub, body.storeId);
  }

  @Post('request-me')
  @HttpCode(200)
  requestMe(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(RequestMeSchema))
    body: z.infer<typeof RequestMeSchema>,
  ) {
    return this.dev.requestMe(req.user.sub, body.botId);
  }

  @Post('accept-mine')
  @HttpCode(200)
  acceptMine(@Req() req: AuthRequest) {
    return this.dev.acceptMine(req.user.sub);
  }

  @Post('log-game-with-me')
  @HttpCode(200)
  logGameWithMe(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(LogGameSchema))
    body: z.infer<typeof LogGameSchema>,
  ) {
    return this.dev.logGameWithMe(req.user.sub, body.winnerId);
  }

  @Post('full-scene')
  @HttpCode(200)
  fullScene(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(StoreOptionalSchema))
    body: z.infer<typeof StoreOptionalSchema>,
  ) {
    return this.dev.fullScene(req.user.sub, body.storeId);
  }

  @Post('pod-for-tracker')
  @HttpCode(200)
  podForTracker(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(PodForTrackerSchema))
    body: z.infer<typeof PodForTrackerSchema>,
  ) {
    return this.dev.podForTracker(req.user.sub, body.seats);
  }

  @Post('invite-spelltable')
  @HttpCode(200)
  inviteSpelltable(@Req() req: AuthRequest) {
    return this.dev.sendPlayInvite(req.user.sub, 'spelltable');
  }

  @Post('invite-convoke')
  @HttpCode(200)
  inviteConvoke(@Req() req: AuthRequest) {
    return this.dev.sendPlayInvite(req.user.sub, 'convoke');
  }

  @Post('reset')
  @HttpCode(200)
  reset(@Req() req: AuthRequest) {
    return this.dev.reset(req.user.sub);
  }
}
