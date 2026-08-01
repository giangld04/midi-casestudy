// Rate limiting middleware using express-rate-limit.
// Mounted AFTER requireAuth on protected route chains, so req.user is populated.
// Authenticated users: 100 req/15min keyed by user id.
// Unauthenticated: 30 req/15min keyed by IP (using ipKeyGenerator for IPv6 safety).
//
// Store: when REDIS_URL is set, counts live in Redis so the limit is shared
// across every API node (behind a load balancer). Without Redis, we fall back
// to express-rate-limit's default in-memory MemoryStore (single-node dev/test).
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { Request } from "express";
import { getRedisClient } from "../lib/redis-client";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Shared Redis store across nodes when available; omit to use MemoryStore.
const redis = getRedisClient();
const store = redis
  ? new RedisStore({
      prefix: "ratelimit:http:",
      // ioredis `call` is variadic (command, ...args) — matches sendCommand.
      sendCommand: (...args: string[]) =>
        redis.call(...(args as [string, ...string[]])) as Promise<number>,
    })
  : undefined;

export const rateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  ...(store ? { store } : {}),
  // Dynamically set limit based on auth status
  limit: (req: Request) => (req.user ? 100 : 30),
  // Key by user id when authenticated; otherwise normalize IP via ipKeyGenerator (IPv6-safe)
  keyGenerator: (req: Request) => {
    if (req.user?.id) return req.user.id;
    return ipKeyGenerator(req.ip ?? "unknown");
  },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests", code: "RATE_LIMITED" },
  // Skip in test environment (tests exceed limits trivially). Health check is
  // unaffected — it lives outside the protected route chains this limiter is mounted on.
  skip: (_req: Request) => process.env["NODE_ENV"] === "test",
});
