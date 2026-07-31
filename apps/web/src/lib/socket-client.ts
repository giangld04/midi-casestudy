// Typed Socket.io client singleton. One connection is shared across the app so
// presence + note streams multiplex over a single WebSocket.
//
// Dev: connects to the API origin (VITE_API_URL, default http://localhost:3000).
// The Vite dev server proxies /api REST calls, but WebSocket connects directly
// to the API (CORS is configured server-side to allow it).

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@ama-midi/shared";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const API_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3000";

/** Lazily-created singleton — connect() is called by the useSocket hook. */
let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(API_URL, {
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      // Send cookies on WebSocket handshake for session auth (Phase 07)
      withCredentials: true,
    });
  }
  return socket;
}
