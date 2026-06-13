import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateGameSchema, type CreateGame } from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { GamesService } from './games.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/games')
@UseGuards(AuthGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Post()
  @HttpCode(201)
  create(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(CreateGameSchema)) body: CreateGame,
  ) {
    return this.games.create(req.user.sub, body);
  }

  @Get('pending')
  getPending(@Req() req: AuthRequest) {
    return this.games.getPending(req.user.sub);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.games.confirm(req.user.sub, id);
  }

  @Post(':id/dispute')
  @HttpCode(200)
  dispute(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.games.dispute(req.user.sub, id);
  }

  @Get('me')
  getMyGames(@Req() req: AuthRequest, @Query('limit') limit?: string) {
    return this.games.getMyGames(req.user.sub, limit ? parseInt(limit, 10) : 20);
  }
}
