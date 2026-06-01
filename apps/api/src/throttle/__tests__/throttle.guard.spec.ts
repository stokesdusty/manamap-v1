import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import { ThrottleGuard } from '../throttle.guard';
import { ThrottleService } from '../throttle.service';
import { type ThrottleOptions } from '../throttle.decorator';

interface MockResponse {
  header: jest.Mock;
}

function makeContext(opts: {
  handlerName?: string;
  className?: string;
  authHeader?: string;
  ip?: string;
  throttleMetadata?: ThrottleOptions | null;
  skipMetadata?: boolean;
}): ExecutionContext & { _res: MockResponse } {
  const req = {
    headers: opts.authHeader ? { authorization: opts.authHeader } : {},
    ip: opts.ip ?? '1.2.3.4',
  };
  const res: MockResponse = { header: jest.fn() };

  const ctx = {
    _res: res,
    getHandler: () => ({ name: opts.handlerName ?? 'testHandler' }),
    getClass: () => ({ name: opts.className ?? 'TestController' }),
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext & { _res: MockResponse };

  return ctx;
}

describe('ThrottleGuard', () => {
  let guard: ThrottleGuard;
  let throttleService: { check: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let jwtService: { decode: jest.Mock };
  let savedThrottleDisabled: string | undefined;

  beforeEach(async () => {
    // Store and clear the env flag so tests exercise real throttle logic
    savedThrottleDisabled = process.env.THROTTLE_DISABLED;
    delete process.env.THROTTLE_DISABLED;

    throttleService = { check: jest.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }) };
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined), // no skip, no named config
    };
    jwtService = { decode: jest.fn().mockReturnValue(null) };

    const module = await Test.createTestingModule({
      providers: [
        ThrottleGuard,
        { provide: ThrottleService, useValue: throttleService },
        { provide: Reflector, useValue: reflector },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    guard = module.get(ThrottleGuard);
  });

  afterEach(() => {
    // Restore env flag
    if (savedThrottleDisabled !== undefined) {
      process.env.THROTTLE_DISABLED = savedThrottleDisabled;
    } else {
      delete process.env.THROTTLE_DISABLED;
    }
  });

  it('allows request when under limit', async () => {
    const result = await guard.canActivate(makeContext({}));
    expect(result).toBe(true);
    expect(throttleService.check).toHaveBeenCalledTimes(1);
  });

  it('throws 429 with Retry-After header when over limit', async () => {
    throttleService.check.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 });
    const ctx = makeContext({});

    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);

    expect(ctx._res.header).toHaveBeenCalledWith('Retry-After', '30');
  });

  it('429 response body contains statusCode, error, and message', async () => {
    throttleService.check.mockResolvedValue({ allowed: false, retryAfterMs: 5_000 });

    let caught: HttpException | undefined;
    try {
      await guard.canActivate(makeContext({}));
    } catch (e) {
      caught = e as HttpException;
    }

    expect(caught).toBeInstanceOf(HttpException);
    expect(caught!.getStatus()).toBe(429);
    const body = caught!.getResponse() as Record<string, unknown>;
    expect(body.statusCode).toBe(429);
    expect(body.error).toBe('Too Many Requests');
    expect(typeof body.message).toBe('string');
  });

  it('uses user ID from JWT as tracker key when Bearer token is present', async () => {
    jwtService.decode.mockReturnValue({ sub: 'user-abc' });

    await guard.canActivate(makeContext({ authHeader: 'Bearer some.jwt.here' }));

    const [key] = throttleService.check.mock.calls[0] as [string, number, number];
    expect(key).toContain('user:user-abc');
    expect(key).not.toMatch(/ip:/);
  });

  it('falls back to IP tracker when no Authorization header', async () => {
    await guard.canActivate(makeContext({ ip: '203.0.113.5' }));

    const [key] = throttleService.check.mock.calls[0] as [string, number, number];
    expect(key).toContain('ip:203.0.113.5');
  });

  it('falls back to IP when JWT decode returns null (malformed token)', async () => {
    jwtService.decode.mockReturnValue(null);

    await guard.canActivate(makeContext({ authHeader: 'Bearer malformed', ip: '10.0.0.1' }));

    const [key] = throttleService.check.mock.calls[0] as [string, number, number];
    expect(key).toContain('ip:10.0.0.1');
  });

  it('uses independent bucket keys for different users — user-B unaffected when user-A is blocked', async () => {
    jwtService.decode
      .mockReturnValueOnce({ sub: 'user-A' })
      .mockReturnValueOnce({ sub: 'user-B' });

    throttleService.check
      .mockResolvedValueOnce({ allowed: false, retryAfterMs: 10_000 }) // user-A blocked
      .mockResolvedValueOnce({ allowed: true, retryAfterMs: 0 });      // user-B OK

    // user-A gets 429
    await expect(guard.canActivate(makeContext({ authHeader: 'Bearer tokenA' }))).rejects.toThrow(
      HttpException,
    );

    // user-B is unaffected
    const resultB = await guard.canActivate(makeContext({ authHeader: 'Bearer tokenB' }));
    expect(resultB).toBe(true);

    // Confirm they used different bucket keys
    const keyA = throttleService.check.mock.calls[0][0] as string;
    const keyB = throttleService.check.mock.calls[1][0] as string;
    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain('user:user-A');
    expect(keyB).toContain('user:user-B');
  });

  it('includes the named throttle config (limit and ttl) when @Throttle is applied', async () => {
    const routeConfig: ThrottleOptions = { name: 'connections', limit: 10, ttl: 600_000 };
    reflector.getAllAndOverride
      .mockReturnValueOnce(undefined)   // SKIP_THROTTLE_KEY → no skip
      .mockReturnValueOnce(routeConfig); // THROTTLE_KEY → named config

    await guard.canActivate(makeContext({}));

    const [_key, limit, ttl] = throttleService.check.mock.calls[0] as [string, number, number];
    expect(limit).toBe(10);
    expect(ttl).toBe(600_000);
  });

  it('uses global defaults when no @Throttle decorator is present', async () => {
    await guard.canActivate(makeContext({}));

    const [_key, limit, ttl] = throttleService.check.mock.calls[0] as [string, number, number];
    expect(limit).toBe(100);
    expect(ttl).toBe(60_000);
  });

  it('skips entirely when @SkipThrottle is applied', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(true); // SKIP_THROTTLE_KEY → skip

    const result = await guard.canActivate(makeContext({}));
    expect(result).toBe(true);
    expect(throttleService.check).not.toHaveBeenCalled();
  });

  it('skips when THROTTLE_DISABLED=true', async () => {
    process.env.THROTTLE_DISABLED = 'true';

    const result = await guard.canActivate(makeContext({}));
    expect(result).toBe(true);
    expect(throttleService.check).not.toHaveBeenCalled();
  });

  it('fails open (allows request) when ThrottleService throws (Redis unavailable)', async () => {
    throttleService.check.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await guard.canActivate(makeContext({}));
    expect(result).toBe(true);
  });

  it('minimum Retry-After is 1 second when retryAfterMs rounds to 0', async () => {
    throttleService.check.mockResolvedValue({ allowed: false, retryAfterMs: 0 });
    const ctx = makeContext({});

    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);

    expect(ctx._res.header).toHaveBeenCalledWith('Retry-After', '1');
  });
});
