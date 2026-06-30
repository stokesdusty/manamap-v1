import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import type { RivalriesService } from './rivalries.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller()
@UseGuards(AuthGuard)
export class RivalriesController {
  constructor(private readonly rivalries: RivalriesService) {}

  @Get('v1/me/rivalries')
  getMyRivalries(@Req() req: AuthRequest, @Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : undefined;
    return this.rivalries.getMyRivalries(
      req.user.sub,
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Get('v1/rivalries/:opponentId')
  getRivalryDetail(@Req() req: AuthRequest, @Param('opponentId') opponentId: string) {
    return this.rivalries.getRivalryDetail(req.user.sub, opponentId);
  }
}
