import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import { AuthGuard, type AccessTokenPayload } from '../auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

const VALID_PAYLOAD: AccessTokenPayload = {
  sub: 'user-uuid',
  email: 'test@example.com',
  role: 'USER',
  iat: 1000000000,
  exp: 9999999999,
};

const ACTIVE_USER = { moderationStatus: 'ACTIVE', suspendedUntil: null };

function mockContext(headers: Record<string, string | undefined>) {
  const req: Record<string, unknown> = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: { verify: jest.Mock };
  let prismaService: { user: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    jwtService = { verify: jest.fn() };
    prismaService = { user: { findUnique: jest.fn().mockResolvedValue(ACTIVE_USER), update: jest.fn().mockResolvedValue({}) } };
    const module = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();
    guard = module.get(AuthGuard);
  });

  it('throws 401 when Authorization header is absent', async () => {
    await expect(guard.canActivate(mockContext({}))).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when scheme is not Bearer', async () => {
    await expect(
      guard.canActivate(mockContext({ authorization: 'Basic dXNlcjpwYXNz' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when JwtService.verify throws (expired / tampered token)', async () => {
    jwtService.verify.mockImplementation(() => { throw new Error('jwt expired'); });
    await expect(
      guard.canActivate(mockContext({ authorization: 'Bearer bad.token.value' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns true and populates req.user with the decoded payload', async () => {
    jwtService.verify.mockReturnValue(VALID_PAYLOAD);
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer valid.jwt.here' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req['user']).toEqual(VALID_PAYLOAD);
  });

  it('passes the raw token (without "Bearer ") to jwtService.verify', async () => {
    jwtService.verify.mockReturnValue(VALID_PAYLOAD);
    await guard.canActivate(mockContext({ authorization: 'Bearer the.actual.token' }));
    expect(jwtService.verify).toHaveBeenCalledWith('the.actual.token');
  });

  it('throws 403 account_banned for banned users', async () => {
    jwtService.verify.mockReturnValue(VALID_PAYLOAD);
    prismaService.user.findUnique.mockResolvedValue({ moderationStatus: 'BANNED', suspendedUntil: null });
    await expect(
      guard.canActivate(mockContext({ authorization: 'Bearer valid.jwt' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 403 account_suspended for suspended users within suspension window', async () => {
    jwtService.verify.mockReturnValue(VALID_PAYLOAD);
    prismaService.user.findUnique.mockResolvedValue({
      moderationStatus: 'SUSPENDED',
      suspendedUntil: new Date(Date.now() + 86_400_000),
    });
    await expect(
      guard.canActivate(mockContext({ authorization: 'Bearer valid.jwt' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows and lazily resets expired suspension', async () => {
    jwtService.verify.mockReturnValue(VALID_PAYLOAD);
    prismaService.user.findUnique.mockResolvedValue({
      moderationStatus: 'SUSPENDED',
      suspendedUntil: new Date(Date.now() - 1000),
    });
    const result = await guard.canActivate(mockContext({ authorization: 'Bearer valid.jwt' }));
    expect(result).toBe(true);
  });
});
