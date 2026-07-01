import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, ForbiddenException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  AppleAuthBodySchema,
  DiscordAuthBodySchema,
  GoogleAuthBodySchema,
  LogoutBodySchema,
  RefreshBodySchema,
  type AppleAuthBody,
  type AuthTokens,
  type DiscordAuthBody,
  type GoogleAuthBody,
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
  apple(
    @Body(new ZodValidationPipe(AppleAuthBodySchema)) body: AppleAuthBody,
  ): Promise<AuthTokens> {
    return this.auth.signInWithApple(body.identityToken);
  }

  @Post('discord')
  @HttpCode(200)
  discord(
    @Body(new ZodValidationPipe(DiscordAuthBodySchema)) body: DiscordAuthBody,
  ): Promise<AuthTokens> {
    return this.auth.signInWithDiscord(body.code, body.codeVerifier, body.redirectUri);
  }

  @Post('google')
  @HttpCode(200)
  google(
    @Body(new ZodValidationPipe(GoogleAuthBodySchema)) body: GoogleAuthBody,
  ): Promise<AuthTokens> {
    return this.auth.signInWithGoogle(body.code, body.codeVerifier, body.redirectUri);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (error || !code) {
      void reply.redirect(
        `manamap://auth/google?error=${encodeURIComponent(error ?? 'cancelled')}`,
      );
      return;
    }
    try {
      const redirectUri = `${req.protocol}://${req.hostname}/api/v1/auth/google/callback`;
      const tokens = await this.auth.signInWithGoogle(code, undefined, redirectUri);
      void reply.redirect(
        `manamap://auth/google?accessToken=${encodeURIComponent(tokens.accessToken)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}&expiresIn=${tokens.expiresIn}`,
      );
    } catch {
      void reply.redirect(
        `manamap://auth/google?error=${encodeURIComponent('Sign in failed. Please try again.')}`,
      );
    }
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

  /**
   * DEV ONLY: Bypass OAuth to test with seeded accounts.
   * Usage: POST /v1/auth/dev-login { "email": "ghalta@example.com" }
   */
  @Post('dev-login')
  @HttpCode(200)
  async devLogin(@Body('email') email: string): Promise<AuthTokens> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev login is only available in development mode');
    }
    // Bypass OAuth for testing
    return this.auth.signInByEmail(email);
  }
}
