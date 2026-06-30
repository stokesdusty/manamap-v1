import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import type { AuthTokens } from '@manamap/shared';
import { PrismaService } from '../prisma/prisma.service';

const ACCESS_EXPIRY_SECS = 15 * 60; // 15 minutes
const REFRESH_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokens(userId: string, email: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const role = user?.role ?? 'USER';
    const accessToken = this.jwt.sign({ sub: userId, email, role });

    const rawRefresh = randomBytes(32).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(rawRefresh),
        expiresAt: new Date(Date.now() + REFRESH_EXPIRY_MS),
      },
    });

    return { accessToken, refreshToken: rawRefresh, expiresIn: ACCESS_EXPIRY_SECS };
  }

  async rotate(rawToken: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: sha256(rawToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!stored) throw new UnauthorizedException('Refresh token invalid or expired');

    // Revoke the consumed token before issuing new ones (rotation)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.userId, stored.user.email);
  }

  async revoke(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
