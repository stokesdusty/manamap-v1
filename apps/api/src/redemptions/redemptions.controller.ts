import { Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { RedemptionsService } from './redemptions.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/offers')
@UseGuards(AuthGuard)
export class RedemptionsController {
  constructor(private readonly redemptions: RedemptionsService) {}

  @Post(':offerId/claim')
  @HttpCode(200)
  claimOffer(@Req() req: AuthRequest, @Param('offerId') offerId: string) {
    return this.redemptions.claimOffer(req.user.sub, offerId);
  }

  @Get(':offerId/my-redemption')
  getMyRedemption(@Req() req: AuthRequest, @Param('offerId') offerId: string) {
    return this.redemptions.getMyRedemption(req.user.sub, offerId);
  }
}
