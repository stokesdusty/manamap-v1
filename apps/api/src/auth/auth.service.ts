import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import type { AuthTokens } from '@manamap/shared';
import type { PinoLogger } from 'nestjs-pino';
import { InjectPinoLogger } from 'nestjs-pino';
import type { Env } from '../config/config.schema';
import { PrismaService } from '../prisma/prisma.service';
import { AppleService } from './apple.service';
import { DiscordService } from './discord.service';
import { GoogleService } from './google.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
    private readonly apple: AppleService,
    private readonly discord: DiscordService,
    private readonly google: GoogleService,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env>,
  ) {}

  async signInWithApple(identityToken: string): Promise<AuthTokens> {
    const { sub, email } = await this.apple.verify(identityToken);

    // Fast path: known identity — no email needed
    const existing = await this.prisma.identity.findFirst({
      where: { provider: 'apple', providerId: sub },
      include: { user: true },
    });
    if (existing) return this.tokens.issueTokens(existing.user.id);

    // First sign-in: Apple includes email only once
    if (!email) throw new BadRequestException('Email is required on first Apple sign-in');

    const user = await this.upsertUserByEmail(email, email.split('@')[0]);
    await this.prisma.identity.create({
      data: { userId: user.id, provider: 'apple', providerId: sub },
    });
    return this.tokens.issueTokens(user.id);
  }

  async signInWithDiscord(
    code: string,
    codeVerifier?: string,
    redirectUri?: string,
  ): Promise<AuthTokens> {
    let profile;
    try {
      profile = await this.discord.exchangeCode(code, codeVerifier, redirectUri);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error({ err }, 'Discord code exchange failed');
      throw error;
    }

    if (!profile.email) {
      this.logger.warn({ discordId: profile.id }, 'Discord sign-in rejected: email missing');
      throw new BadRequestException(
        'Discord account must have a verified email (enable the email scope)',
      );
    }

    const discordHandle = profile.global_name ?? profile.username ?? 'Discord User';

    const existing = await this.prisma.identity.findFirst({
      where: { provider: 'discord', providerId: profile.id },
      include: { user: true },
    });

    if (existing) {
      // Keep discord_handle in sync when the user changes their Discord name
      if (existing.discordHandle !== discordHandle) {
        await this.prisma.identity.update({
          where: { id: existing.id },
          data: { discordHandle },
        });
      }
      return this.tokens.issueTokens(existing.user.id);
    }

    const user = await this.upsertUserByEmail(profile.email, discordHandle);
    await this.prisma.identity.create({
      data: { userId: user.id, provider: 'discord', providerId: profile.id, discordHandle },
    });
    await this.prisma.socialLink.upsert({
      where: { userId_platform: { userId: user.id, platform: 'DISCORD' } },
      create: { userId: user.id, platform: 'DISCORD', value: discordHandle, visibility: 'PUBLIC' },
      update: {},
    });
    return this.tokens.issueTokens(user.id);
  }

  async signInWithGoogle(idToken: string): Promise<AuthTokens> {
    const profile = await this.google.verifyIdToken(idToken);

    if (!profile.email) {
      throw new BadRequestException('Google account must have an email');
    }

    const existing = await this.prisma.identity.findFirst({
      where: { provider: 'google', providerId: profile.sub },
      include: { user: true },
    });
    if (existing) return this.tokens.issueTokens(existing.user.id);

    const user = await this.upsertUserByEmail(profile.email, profile.name ?? 'Google User');
    await this.prisma.identity.create({
      data: { userId: user.id, provider: 'google', providerId: profile.sub },
    });
    return this.tokens.issueTokens(user.id);
  }

  refresh(rawToken: string): Promise<AuthTokens> {
    return this.tokens.rotate(rawToken);
  }

  logout(rawToken: string): Promise<void> {
    return this.tokens.revoke(rawToken);
  }

  async signInByEmail(email: string): Promise<AuthTokens> {
    const user = await this.upsertUserByEmail(email, email.split('@')[0]);
    return this.tokens.issueTokens(user.id);
  }

  private isAdminEmail(email: string): boolean {
    const adminEmails = (this.config.get('ADMIN_EMAILS', { infer: true }) ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return adminEmails.includes(email.trim().toLowerCase());
  }

  private async upsertUserByEmail(
    email: string,
    displayName: string,
  ): Promise<{ id: string; email: string }> {
    const adminRole = this.isAdminEmail(email) ? { role: UserRole.ADMIN } : {};
    return this.prisma.user.upsert({
      where: { email },
      update: { ...adminRole },
      create: {
        email,
        displayName,
        privacySettings: { create: {} },
        ...adminRole,
      },
      select: { id: true, email: true },
    });
  }
}
