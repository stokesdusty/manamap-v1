import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AssociateCheckinEventBodySchema,
  CheckinBodySchema,
  ConfirmStoreSchema,
  NotifyWhenActiveBodySchema,
  SuggestStoreSchema,
  type AssociateCheckinEventBody,
  type CheckinBody,
  type ConfirmStore,
  type NotifyWhenActiveBody,
  type SuggestStore,
} from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import type { StoresService } from './stores.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/stores')
@UseGuards(AuthGuard)
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  list(
    @Query('bbox') bbox: string | undefined,
    @Query('q') q: string | undefined,
    @Query('includeProposed') includeProposed?: string,
  ) {
    return this.stores.list({ bbox, q, includeProposed: includeProposed === 'true' });
  }

  @Post('suggest')
  @HttpCode(201)
  suggestStore(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(SuggestStoreSchema)) body: SuggestStore,
  ) {
    return this.stores.suggestStore(req.user.sub, body);
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.stores.getDetail(id);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirmStore(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ConfirmStoreSchema)) body: ConfirmStore,
  ) {
    return this.stores.confirmStore(req.user.sub, id, body);
  }

  @Post(':id/checkin')
  @HttpCode(200)
  checkin(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CheckinBodySchema)) body: CheckinBody,
  ) {
    return this.stores.checkin(req.user.sub, id, body);
  }

  @Get(':id/events')
  getEvents(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.stores.getEvents(req.user.sub, id);
  }

  @Get(':id/leaderboard')
  getLeaderboard(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.stores.getLeaderboard(req.user.sub, id);
  }

  @Get(':id/offers')
  getOffers(@Param('id') id: string) {
    return this.stores.getActiveOffers(id);
  }

  @Post(':id/events/:eventId/attend')
  @HttpCode(200)
  attendEvent(@Req() req: AuthRequest, @Param('id') id: string, @Param('eventId') eventId: string) {
    return this.stores.attendEvent(req.user.sub, id, eventId);
  }

  @Delete(':id/events/:eventId/attend')
  @HttpCode(200)
  unattendEvent(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
  ) {
    return this.stores.unattendEvent(req.user.sub, id, eventId);
  }

  @Post(':id/checkin/:checkinId/event')
  @HttpCode(200)
  associateCheckinEvent(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('checkinId') checkinId: string,
    @Body(new ZodValidationPipe(AssociateCheckinEventBodySchema)) body: AssociateCheckinEventBody,
  ) {
    return this.stores.associateCheckinEvent(req.user.sub, id, checkinId, body);
  }

  @Get(':id/events/:eventId/attendance')
  getEventAttendance(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
  ) {
    return this.stores.getEventAttendance(req.user.sub, id, eventId);
  }

  @Post(':id/notify-when-active')
  @HttpCode(200)
  notifyWhenActive(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(NotifyWhenActiveBodySchema)) body: NotifyWhenActiveBody,
  ) {
    return this.stores.notifyWhenActive(req.user.sub, id, body.threshold);
  }
}
