// Shared ioredis command client for cross-node state (rate limiting).
// Returns null when REDIS_URL is unset so callers gracefully fall back to
// in-memory behavior (dev / test / single-node). This is a plain command
// client — distinct from the socket adapter's dedicated pub/sub connections.

import { Redis } from "ioredis";

// undefined = not yet resolved; null = resolved to "no Redis" (single-node).
let client: Redis | null | undefined;

/**
 * Lazily create (once) and return the shared Redis client, or null when
 * REDIS_URL is absent. Never throws — connection errors are logged; commands
 * queue/retry per ioredis defaults and callers fail open to in-memory.
 */
export function getRedisClient(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env["REDIS_URL"];
  if (!url) {
    console.log(
      "[redis] REDIS_URL not set — rate limiting uses in-memory store (single node)",
    );
    client = null;
    return client;
  }

  const c = new Redis(url, {
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  c.on("error", (err) => console.error("[redis] client error:", err.message));
  client = c;
  return client;
}

/** Close the shared client (graceful shutdown / test teardown). */
export async function closeRedisClient(): Promise<void> {
  if (client) await client.quit();
  client = undefined;
}
