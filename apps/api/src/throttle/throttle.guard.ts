import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SKIP_THROTTLE_KEY, THROTTLE_KEY, type ThrottleOptions } from './throttle.decorator';
import { ThrottleService } from './throttle.service';
import { THROTTLE_GLOBAL_LIMIT, THROTTLE_GLOBAL_TTL } from './throttle.constants';

const GLOBAL_DEFAULT: ThrottleOptions = {
  name: 'global',
  limit: THROTTLE_GLOBAL_LIMIT,
  ttl: THROTTLE_GLOBAL_TTL,
};

@Injectable()
export class ThrottleGuard implements CanActivate {
  constructor(
    private readonly throttleService: ThrottleService,
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.THROTTLE_DISABLED === 'true') return true;

    const skip = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const config =
      this.reflector.getAllAndOverride<ThrottleOptions | undefined>(THROTTLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? GLOBAL_DEFAULT;

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      ip: string;
    }>();

    const tracker = this.resolveTracker(req);
    const className = context.getClass().name;
    const handlerName = context.getHandler().name;
    const key = `throttle:${config.name}:${className}.${handlerName}:${tracker}`;

    let result: { allowed: boolean; retryAfterMs: number };
    try {
      result = await this.throttleService.check(key, config.limit, config.ttl);
    } catch {
      if (config.failClosed) {
        // Fail closed: a Redis outage must not remove brute-force protection
        // on auth-sensitive routes, so reject rather than let the request through.
        const res = context.switchToHttp().getResponse<{ header: (k: string, v: string) => void }>();
        res.header('Retry-After', '5');
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            error: 'Service Unavailable',
            message: 'Service temporarily unavailable',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      // Fail open: if Redis is unavailable, don't block legitimate traffic
      return true;
    }

    if (!result.allowed) {
      const retryAfterSecs = Math.ceil(result.retryAfterMs / 1000) || 1;
      const res = context.switchToHttp().getResponse<{ header: (k: string, v: string) => void }>();
      res.header('Retry-After', String(retryAfterSecs));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveTracker(req: { headers: { authorization?: string }; ip: string }): string {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = this.jwtService.decode<{ sub?: string }>(auth.slice(7));
        if (payload?.sub) return `user:${payload.sub}`;
      } catch {
        // fall through to IP
      }
    }
    return `ip:${req.ip ?? 'unknown'}`;
  }
}
