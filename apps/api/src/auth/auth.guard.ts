import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ModerationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string; // UserRole value
  iat: number;
  exp: number;
}

type GuardRequest = {
  headers: { authorization?: string };
  user?: AccessTokenPayload;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<GuardRequest>();
    const auth = req.headers.authorization;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    let payload: AccessTokenPayload;
    try {
      payload = this.jwtService.verify<AccessTokenPayload>(auth.slice(7));
    } catch {
      throw new UnauthorizedException();
    }

    req.user = payload;

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { moderationStatus: true, suspendedUntil: true, deletedAt: true },
    });

    if (!user || user.deletedAt) throw new UnauthorizedException();

    if (user.moderationStatus === ModerationStatus.BANNED) {
      throw new ForbiddenException('account_banned');
    }

    if (user.moderationStatus === ModerationStatus.SUSPENDED) {
      if (user.suspendedUntil && user.suspendedUntil > new Date()) {
        throw new ForbiddenException('account_suspended');
      }
      // Suspension expired — lazily reset (fire and forget)
      void this.prisma.user.update({
        where: { id: payload.sub },
        data: { moderationStatus: ModerationStatus.ACTIVE, suspendedUntil: null },
      });
    }

    return true;
  }
}
