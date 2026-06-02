import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import {
  ClaimStoreSchema, CreateEventSchema, CreateRewardOfferSchema, RedeemCodeSchema,
  SendBroadcastSchema, UpdateEventSchema, UpdateRewardOfferSchema, UpdateStoreProfileSchema,
  type ClaimStore, type CreateEvent, type CreateRewardOffer, type RedeemCode,
  type SendBroadcast, type UpdateEvent, type UpdateRewardOffer, type UpdateStoreProfile,
} from '@manamap/shared';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PartnerService } from './partner.service';
import { BroadcastService } from './broadcast.service';
import { RedemptionsService } from '../redemptions/redemptions.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/partner')
@UseGuards(AuthGuard)
export class PartnerController {
  constructor(
    private readonly partner: PartnerService,
    private readonly broadcast: BroadcastService,
    private readonly redemptions: RedemptionsService,
  ) {}

  // --- Store ownership ---

  @Post('stores/claim')
  @HttpCode(200)
  claimStore(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(ClaimStoreSchema)) body: ClaimStore,
  ) {
    return this.partner.claimStore(req.user.sub, body.storeId);
  }

  @Get('stores')
  getMyStores(@Req() req: AuthRequest) {
    return this.partner.getMyStores(req.user.sub);
  }

  @Patch('stores/:storeId')
  @HttpCode(200)
  updateStore(
    @Req() req: AuthRequest,
    @Param('storeId') storeId: string,
    @Body(new ZodValidationPipe(UpdateStoreProfileSchema)) body: UpdateStoreProfile,
  ) {
    return this.partner.updateStoreProfile(req.user.sub, storeId, body);
  }

  // --- Analytics ---

  @Get('stores/:storeId/analytics')
  getAnalytics(@Req() req: AuthRequest, @Param('storeId') storeId: string) {
    return this.partner.getAnalytics(req.user.sub, storeId);
  }

  // --- Offer CRUD ---

  @Get('stores/:storeId/offers')
  listOffers(@Req() req: AuthRequest, @Param('storeId') storeId: string) {
    return this.partner.listOffers(req.user.sub, storeId);
  }

  @Post('stores/:storeId/offers')
  @HttpCode(201)
  createOffer(
    @Req() req: AuthRequest,
    @Param('storeId') storeId: string,
    @Body(new ZodValidationPipe(CreateRewardOfferSchema)) body: CreateRewardOffer,
  ) {
    return this.partner.createOffer(req.user.sub, storeId, body);
  }

  @Patch('stores/:storeId/offers/:offerId')
  @HttpCode(200)
  updateOffer(
    @Req() req: AuthRequest,
    @Param('storeId') storeId: string,
    @Param('offerId') offerId: string,
    @Body(new ZodValidationPipe(UpdateRewardOfferSchema)) body: UpdateRewardOffer,
  ) {
    return this.partner.updateOffer(req.user.sub, storeId, offerId, body);
  }

  @Delete('stores/:storeId/offers/:offerId')
  @HttpCode(204)
  deleteOffer(
    @Req() req: AuthRequest,
    @Param('storeId') storeId: string,
    @Param('offerId') offerId: string,
  ) {
    return this.partner.deleteOffer(req.user.sub, storeId, offerId);
  }

  // --- Formats ---

  @Get('formats')
  listFormats() {
    return this.partner.listFormats();
  }

  // --- Event CRUD ---

  @Get('stores/:storeId/events')
  listEvents(@Req() req: AuthRequest, @Param('storeId') storeId: string) {
    return this.partner.listPartnerEvents(req.user.sub, storeId);
  }

  @Post('stores/:storeId/events')
  @HttpCode(201)
  createEvent(
    @Req() req: AuthRequest,
    @Param('storeId') storeId: string,
    @Body(new ZodValidationPipe(CreateEventSchema)) body: CreateEvent,
  ) {
    return this.partner.createPartnerEvent(req.user.sub, storeId, body);
  }

  @Patch('stores/:storeId/events/:eventId')
  @HttpCode(200)
  updateEvent(
    @Req() req: AuthRequest,
    @Param('storeId') storeId: string,
    @Param('eventId') eventId: string,
    @Body(new ZodValidationPipe(UpdateEventSchema)) body: UpdateEvent,
  ) {
    return this.partner.updatePartnerEvent(req.user.sub, storeId, eventId, body);
  }

  @Delete('stores/:storeId/events/:eventId')
  @HttpCode(204)
  deleteEvent(
    @Req() req: AuthRequest,
    @Param('storeId') storeId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.partner.deletePartnerEvent(req.user.sub, storeId, eventId);
  }

  // --- Broadcast ---

  @Get('stores/:storeId/broadcast/audiences')
  getAudiences(@Req() req: AuthRequest, @Param('storeId') storeId: string) {
    return this.broadcast.getAudienceCounts(req.user.sub, storeId);
  }

  @Post('stores/:storeId/broadcast')
  @HttpCode(200)
  sendBroadcast(
    @Req() req: AuthRequest,
    @Param('storeId') storeId: string,
    @Body(new ZodValidationPipe(SendBroadcastSchema)) body: SendBroadcast,
  ) {
    return this.broadcast.sendBroadcast(req.user.sub, storeId, body);
  }

  @Get('stores/:storeId/broadcast')
  listBroadcasts(@Req() req: AuthRequest, @Param('storeId') storeId: string) {
    return this.broadcast.listBroadcasts(req.user.sub, storeId);
  }

  // --- Redemptions ---

  @Get('stores/:storeId/redemptions/verify')
  verifyRedemption(
    @Req() req: AuthRequest,
    @Param('storeId') storeId: string,
    @Query('code') code: string,
  ) {
    return this.redemptions.verifyCode(req.user.sub, storeId, (code ?? '').toUpperCase());
  }

  @Post('stores/:storeId/redemptions/redeem')
  @HttpCode(200)
  redeemCode(
    @Req() req: AuthRequest,
    @Param('storeId') storeId: string,
    @Body(new ZodValidationPipe(RedeemCodeSchema)) body: RedeemCode,
  ) {
    return this.redemptions.redeemCode(req.user.sub, storeId, body.code.toUpperCase());
  }

  @Get('stores/:storeId/redemptions')
  listRedemptions(
    @Req() req: AuthRequest,
    @Param('storeId') storeId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.redemptions.listRedemptions(req.user.sub, storeId, {
      ...(status !== undefined ? { status } : {}),
      ...(limit !== undefined ? { limit: parseInt(limit, 10) } : {}),
    });
  }
}
