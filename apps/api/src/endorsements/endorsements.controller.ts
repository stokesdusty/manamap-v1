import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { EndorseInputSchema, type EndorseInput } from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { EndorsementsService } from './endorsements.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/games')
@UseGuards(AuthGuard)
export class EndorsementsController {
  constructor(private readonly endorsements: EndorsementsService) {}

  @Post(':gameLogId/endorse')
  @HttpCode(201)
  endorse(
    @Req() req: AuthRequest,
    @Param('gameLogId') gameLogId: string,
    @Body(new ZodValidationPipe(EndorseInputSchema)) body: EndorseInput,
  ) {
    return this.endorsements.endorse(req.user.sub, gameLogId, body);
  }
}
