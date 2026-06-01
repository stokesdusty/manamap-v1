import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

// Atomically checks and records a hit in a sliding window using a Redis sorted set.
// Returns [1, 0] when the request is allowed.
// Returns [0, oldestScore] when the limit is exceeded — oldestScore is the ms timestamp
// of the oldest entry still in the window, used to compute Retry-After.
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_start = tonumber(ARGV[2])
local lim = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local member = ARGV[5]
redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
local count = redis.call('ZCARD', key)
if count >= lim then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  if #oldest >= 2 then return {0, tonumber(oldest[2])} end
  return {0, now}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, ttl)
return {1, 0}
`;

export interface SlidingWindowResult {
  allowed: boolean;
  retryAfterMs: number;
}

@Injectable()
export class ThrottleService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async check(key: string, limit: number, ttlMs: number): Promise<SlidingWindowResult> {
    const now = Date.now();
    const windowStart = now - ttlMs;
    const member = `${now}:${Math.random().toString(36).slice(2)}`;

    const result = (await this.redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      key,
      String(now),
      String(windowStart),
      String(limit),
      String(ttlMs),
      member,
    )) as [number, number];

    if (result[0] === 1) {
      return { allowed: true, retryAfterMs: 0 };
    }

    const oldestTs = result[1];
    const retryAfterMs = Math.max(0, oldestTs + ttlMs - now);
    return { allowed: false, retryAfterMs };
  }
}
