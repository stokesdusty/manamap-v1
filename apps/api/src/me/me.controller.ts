import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CreateDeckLinkSchema,
  OnboardingSubmitSchema,
  RegisterPushTokenSchema,
  SetHomeStoreSchema,
  UpdateDeckLinkSchema,
  UpdatePrivacySchema,
  UpdateProfileSchema,
  type CreateDeckLink,
  type OnboardingSubmit,
  type RegisterPushToken,
  type SetHomeStore,
  type UpdateDeckLink,
  type UpdatePrivacy,
  type UpdateProfile,
} from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { MeService } from './me.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  getProfile(@Req() req: AuthRequest) {
    return this.me.getProfile(req.user.sub);
  }

  @Patch()
  @HttpCode(200)
  updateProfile(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) body: UpdateProfile,
  ) {
    return this.me.updateProfile(req.user.sub, body);
  }

  @Get('privacy')
  getPrivacy(@Req() req: AuthRequest) {
    return this.me.getPrivacy(req.user.sub);
  }

  @Patch('privacy')
  @HttpCode(200)
  updatePrivacy(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(UpdatePrivacySchema)) body: UpdatePrivacy,
  ) {
    return this.me.updatePrivacy(req.user.sub, body);
  }

  @Get('decks')
  getDecks(@Req() req: AuthRequest) {
    return this.me.getDecks(req.user.sub);
  }

  @Post('decks')
  @HttpCode(201)
  createDeck(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(CreateDeckLinkSchema)) body: CreateDeckLink,
  ) {
    return this.me.createDeck(req.user.sub, body);
  }

  @Patch('decks/:id')
  @HttpCode(200)
  updateDeck(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDeckLinkSchema)) body: UpdateDeckLink,
  ) {
    return this.me.updateDeck(req.user.sub, id, body);
  }

  @Delete('decks/:id')
  @HttpCode(204)
  deleteDeck(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.me.deleteDeck(req.user.sub, id);
  }

  @Post('push-token')
  @HttpCode(200)
  registerPushToken(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(RegisterPushTokenSchema)) body: RegisterPushToken,
  ) {
    return this.me.registerPushToken(req.user.sub, body.token);
  }

  @Get('badges')
  getBadges(@Req() req: AuthRequest) {
    return this.me.getBadges(req.user.sub);
  }

  @Get('streaks')
  getStreaks(@Req() req: AuthRequest) {
    return this.me.getStreaksSummary(req.user.sub);
  }

  @Get('recent-stores')
  getRecentStores(@Req() req: AuthRequest) {
    return this.me.getRecentStores(req.user.sub);
  }

  @Get('home-store')
  getHomeStore(@Req() req: AuthRequest) {
    return this.me.getHomeStore(req.user.sub);
  }

  @Patch('home-store')
  @HttpCode(200)
  setHomeStore(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(SetHomeStoreSchema)) body: SetHomeStore,
  ) {
    return this.me.setHomeStore(req.user.sub, body);
  }

  @Post('onboarding')
  @HttpCode(200)
  submitOnboarding(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(OnboardingSubmitSchema)) body: OnboardingSubmit,
  ) {
    return this.me.submitOnboarding(req.user.sub, body);
  }

  @Get('stats')
  getGameStats(@Req() req: AuthRequest) {
    return this.me.getGameStats(req.user.sub);
  }
}
