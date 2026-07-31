// Optional Socket.io Redis adapter factory. Enables horizontal scaling: events
// broadcast on one node reach clients connected to other nodes via Redis Pub/Sub.
//
// Graceful degradation: if REDIS_URL is unset or the connection fails, we return
// undefined and the caller falls back to the default in-memory adapter (fine for
// single-instance dev/test). This keeps local runs and CI working without Redis.

import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Server } from "socket.io";

type AdapterFactory = ReturnType<typeof createAdapter>;

/**
 * Build a Redis adapter for the given Socket.io server, or undefined when Redis
 * is unavailable. Never throws — connection errors are logged and swallowed.
 */
export async function createRedisAdapter(): Promise<AdapterFactory | undefined> {
  const url = process.env["REDIS_URL"];
  if (!url) {
    console.log("[socket] REDIS_URL not set — using in-memory adapter (single node)");
    return undefined;
  }

  try {
    // lazyConnect so we can await the first connection and catch failures here.
    // retryStrategy:null + short connectTimeout make connect() reject FAST when
    // Redis is down, so we fall back cleanly instead of hanging/retrying forever.
    const pubClient = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    // Prevent unhandled 'error' events from crashing the process later
    pubClient.on("error", (err) => console.error("[socket] redis pub error:", err.message));
    subClient.on("error", (err) => console.error("[socket] redis sub error:", err.message));
    console.log("[socket] Redis adapter connected — horizontal scaling enabled");
    return createAdapter(pubClient, subClient);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[socket] Redis unavailable (${msg}) — falling back to in-memory adapter`);
    return undefined;
  }
}

/** Attach the Redis adapter to a server if one could be created. */
export async function attachRedisAdapter(io: Server): Promise<void> {
  const adapter = await createRedisAdapter();
  if (adapter) io.adapter(adapter);
}
