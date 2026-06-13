import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import { AuthGuard, type AccessTokenPayload } from '../auth.guard';

const VALID_PAYLOAD: AccessTokenPayload = {
  sub: 'user-uuid',
  email: 'test@example.com',
  role: 'USER',
  iat: 1000000000,
  exp: 9999999999,
};

function mockContext(headers: Record<string, string | undefined>) {
  const req: Record<string, unknown> = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: { verify: jest.Mock };

  beforeEach(async () => {
    jwtService = { verify: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [AuthGuard, { provide: JwtService, useValue: jwtService }],
    }).compile();
    guard = module.get(AuthGuard);
  });

  it('throws 401 when Authorization header is absent', () => {
    expect(() => guard.canActivate(mockContext({}))).toThrow(UnauthorizedException);
  });

  it('throws 401 when scheme is not Bearer', () => {
    expect(() =>
      guard.canActivate(mockContext({ authorization: 'Basic dXNlcjpwYXNz' })),
    ).toThrow(UnauthorizedException);
  });

  it('throws 401 when JwtService.verify throws (expired / tampered token)', () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    expect(() =>
      guard.canActivate(mockContext({ authorization: 'Bearer bad.token.value' })),
    ).toThrow(UnauthorizedException);
  });

  it('returns true and populates req.user with the decoded payload', () => {
    jwtService.verify.mockReturnValue(VALID_PAYLOAD);
    const req: Record<string, unknown> = {
      headers: { authorization: 'Bearer valid.jwt.here' },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req['user']).toEqual(VALID_PAYLOAD);
  });

  it('passes the raw token (without "Bearer ") to jwtService.verify', () => {
    jwtService.verify.mockReturnValue(VALID_PAYLOAD);
    guard.canActivate(mockContext({ authorization: 'Bearer the.actual.token' }));
    expect(jwtService.verify).toHaveBeenCalledWith('the.actual.token');
  });
});
