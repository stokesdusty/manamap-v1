import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { AuthTokens } from '@manamap/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppleService } from './apple.service';
import { DiscordService } from './discord.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly apple: AppleService,
    private readonly discord: DiscordService,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async signInWithApple(identityToken: string): Promise<AuthTokens> {
    const { sub, email } = await this.apple.verify(identityToken);

    // Fast path: known identity — no email needed
    const existing = await this.prisma.identity.findFirst({
      where: { provider: 'apple', providerId: sub },
      include: { user: true },
    });
    if (existing) return this.tokens.issueTokens(existing.user.id, existing.user.email);

    // First sign-in: Apple includes email only once
    if (!email) throw new BadRequestException('Email is required on first Apple sign-in');

    const user = await this.upsertUserByEmail(email, email.split('@')[0]);
    await this.prisma.identity.create({
      data: { userId: user.id, provider: 'apple', providerId: sub },
    });
    return this.tokens.issueTokens(user.id, user.email);
  }

  async signInWithDiscord(code: string, codeVerifier?: string, redirectUri?: string): Promise<AuthTokens> {
    let profile;
    try {
      profile = await this.discord.exchangeCode(code, codeVerifier, redirectUri);
    } catch (error: any) {
      this.logger.error(`Discord code exchange failed: ${error.message}`, error.stack);
      throw error;
    }

    if (!profile.email) {
      this.logger.warn(`Discord sign-in failed: Email missing for user ${profile.id}`);
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
      return this.tokens.issueTokens(existing.user.id, existing.user.email);
    }

    const user = await this.upsertUserByEmail(profile.email, discordHandle);
    await this.prisma.identity.create({
      data: { userId: user.id, provider: 'discord', providerId: profile.id, discordHandle },
    });
    return this.tokens.issueTokens(user.id, user.email);
  }

  refresh(rawToken: string): Promise<AuthTokens> {
    return this.tokens.rotate(rawToken);
  }

  logout(rawToken: string): Promise<void> {
    return this.tokens.revoke(rawToken);
  }

  async signInByEmail(email: string): Promise<AuthTokens> {
    const user = await this.upsertUserByEmail(email, email.split('@')[0]);
    return this.tokens.issueTokens(user.id, user.email);
  }

  private async upsertUserByEmail(
    email: string,
    displayName: string,
  ): Promise<{ id: string; email: string }> {
    return this.prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        displayName,
        privacySettings: { create: {} },
      },
      select: { id: true, email: true },
    });
  }
}
