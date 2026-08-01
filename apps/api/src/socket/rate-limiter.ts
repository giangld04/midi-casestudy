// Sliding-window-log rate limiter for socket note mutations (60 events/min).
//
// Backed by Redis (a sorted set per key) when REDIS_URL is set, so the limit is
// shared across every API node AND across all of a user's connections/tabs —
// keying by userId. Falls back to an in-memory window for single-node dev/test
// when Redis is absent, or transiently if a Redis command fails (fail-open so
// real-time editing is never blocked by an infra hiccup).

import type { Redis } from "ioredis";
import { getRedisClient } from "../lib/redis-client";

interface Window {
  timestamps: number[];
}

// Atomic sliding-window in Redis. Trim entries older than the window, count the
// rest, and only record `now` if under the limit — all in one round-trip so
// concurrent events on different nodes can't race past the cap.
//   KEYS[1] = zset key
//   ARGV[1] = now (ms)            ARGV[2] = cutoff (now - intervalMs)
//   ARGV[3] = limit              ARGV[4] = ttl (ms)   ARGV[5] = unique member
// Returns 1 when allowed (and records), 0 when over the limit.
const SLIDING_WINDOW_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[2])
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[3]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[5])
redis.call('PEXPIRE', KEYS[1], ARGV[4])
return 1
`;

export class RateLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly redis: Redis | null;

  constructor(
    private readonly limit: number,
    private readonly intervalMs: number,
    redis: Redis | null = getRedisClient(),
  ) {
    this.redis = redis;
  }

  /** Returns true if the action is allowed and records it; false if over limit. */
  async take(key: string): Promise<boolean> {
    if (this.redis) {
      try {
        const now = Date.now();
        const member = `${now}-${Math.random().toString(36).slice(2)}`;
        const res = await this.redis.eval(
          SLIDING_WINDOW_LUA,
          1,
          `ratelimit:socket:${key}`,
          String(now),
          String(now - this.intervalMs),
          String(this.limit),
          String(this.intervalMs),
          member,
        );
        return res === 1;
      } catch {
        // Redis unavailable → fail open to in-memory so editing keeps working.
        return this.takeInMemory(key);
      }
    }
    return this.takeInMemory(key);
  }

  /** Local sliding-window fallback (bounded array of recent timestamps per key). */
  private takeInMemory(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.intervalMs;
    const win = this.windows.get(key) ?? { timestamps: [] };
    win.timestamps = win.timestamps.filter((t) => t > cutoff);
    if (win.timestamps.length >= this.limit) {
      this.windows.set(key, win);
      return false;
    }
    win.timestamps.push(now);
    this.windows.set(key, win);
    return true;
  }

  /** Forget an in-memory key (call on disconnect to avoid unbounded growth).
   *  Redis entries self-expire via PEXPIRE, so no explicit cleanup is needed. */
  clear(key: string): void {
    this.windows.delete(key);
  }
}
