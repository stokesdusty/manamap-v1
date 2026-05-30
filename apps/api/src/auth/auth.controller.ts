import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  AppleAuthBodySchema,
  DiscordAuthBodySchema,
  LogoutBodySchema,
  RefreshBodySchema,
  type AppleAuthBody,
  type AuthTokens,
  type DiscordAuthBody,
  type LogoutBody,
  type RefreshBody,
} from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('apple')
  @HttpCode(200)
  apple(@Body(new ZodValidationPipe(AppleAuthBodySchema)) body: AppleAuthBody): Promise<AuthTokens> {
    return this.auth.signInWithApple(body.identityToken);
  }

  @Post('discord')
  @HttpCode(200)
  discord(
    @Body(new ZodValidationPipe(DiscordAuthBodySchema)) body: DiscordAuthBody,
  ): Promise<AuthTokens> {
    return this.auth.signInWithDiscord(body.code);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(RefreshBodySchema)) body: RefreshBody): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Body(new ZodValidationPipe(LogoutBodySchema)) body: LogoutBody): Promise<void> {
    return this.auth.logout(body.refreshToken);
  }
}
