import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import {
  ResolveTokenBodySchema,
  type ResolveTokenBody,
} from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { ExchangeService } from './exchange.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/exchange')
export class ExchangeController {
  constructor(private readonly exchange: ExchangeService) {}

  @Post('token')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  mintToken(@Req() req: AuthRequest) {
    return this.exchange.mintToken(req.user.sub);
  }

  @Post('resolve')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  resolveToken(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(ResolveTokenBodySchema)) body: ResolveTokenBody,
  ) {
    return this.exchange.resolveToken(req.user.sub, body.token);
  }
}
