import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = Symbol('THROTTLE');
export const SKIP_THROTTLE_KEY = Symbol('SKIP_THROTTLE');

export interface ThrottleOptions {
  name: string;
  limit: number;
  ttl: number; // ms
  // When true, a Redis outage rejects the request instead of letting it through.
  // Reserve for brute-force-sensitive routes (login, token exchange) — everything
  // else should fail open so a Redis blip doesn't take down the whole API.
  failClosed?: boolean;
}

export const Throttle = (options: ThrottleOptions): MethodDecorator & ClassDecorator =>
  SetMetadata(THROTTLE_KEY, options);

export const SkipThrottle = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_THROTTLE_KEY, true);
