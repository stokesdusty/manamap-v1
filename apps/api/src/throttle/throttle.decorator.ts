import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = Symbol('THROTTLE');
export const SKIP_THROTTLE_KEY = Symbol('SKIP_THROTTLE');

export interface ThrottleOptions {
  name: string;
  limit: number;
  ttl: number; // ms
}

export const Throttle = (options: ThrottleOptions): MethodDecorator & ClassDecorator =>
  SetMetadata(THROTTLE_KEY, options);

export const SkipThrottle = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_THROTTLE_KEY, true);
