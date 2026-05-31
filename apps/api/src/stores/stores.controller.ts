import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { StoresService } from './stores.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/stores')
@UseGuards(AuthGuard)
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  list(@Query('bbox') bbox: string | undefined, @Query('q') q: string | undefined) {
    return this.stores.list({ bbox, q });
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.stores.getDetail(id);
  }

  @Post(':id/checkin')
  @HttpCode(200)
  checkin(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.stores.checkin(req.user.sub, id);
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
  attendEvent(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
  ) {
    return this.stores.attendEvent(req.user.sub, id, eventId);
  }
}
