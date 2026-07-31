// Socket.io server bootstrap. Attaches to the shared Node HTTP server so REST
// and WebSocket share one port/origin. Wires the Redis adapter (optional) and
// registers per-connection room + note handlers.
// Phase 07: socket connections require a valid session (cookie-based auth).

import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@ama-midi/shared";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/auth-config";
import { attachRedisAdapter } from "./redis-adapter";
import { registerSongRoomHandlers } from "./song-room-handler";
import { registerNoteEventHandlers } from "./note-event-handler";

/** Per-socket data set by auth middleware (available in all event handlers). */
export interface SocketData {
  userId: string;
}

export type AppIO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Create + configure the Socket.io server. Redis adapter attaches asynchronously
 * (non-blocking); connections work immediately with the in-memory adapter until
 * Redis is ready, then transparently upgrade.
 */
export function createSocketServer(httpServer: HttpServer): AppIO {
  const io: AppIO = new Server(httpServer, {
    // websocket only — skip HTTP long-polling handshake overhead
    transports: ["websocket"],
    cors: {
      origin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
      credentials: true,
    },
    // Keep dropped clients from lingering in presence too long
    pingTimeout: 20_000,
  });

  // Best-effort horizontal scaling; ignored if Redis is unavailable
  void attachRedisAdapter(io);

  // Auth middleware — validate session from cookie on handshake.
  // In test env, socket.io-client passes cookie via extraHeaders; node honors them.
  io.use(async (socket, next) => {
    try {
      // Build a Headers object from socket handshake headers
      const handshakeHeaders = socket.handshake.headers;
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(handshakeHeaders as Parameters<typeof fromNodeHeaders>[0]),
      });

      if (!session) {
        next(new Error("UNAUTHORIZED"));
        return;
      }

      socket.data.userId = session.user.id;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    registerSongRoomHandlers(io, socket);
    registerNoteEventHandlers(io, socket);
  });

  return io;
}
