// Typed Socket.io client singleton. One connection is shared across the app so
// presence + note streams multiplex over a single WebSocket.
//
// Same-origin by default: with VITE_API_URL empty the socket connects to THIS
// origin, where nginx (prod) / the Vite dev proxy forwards /socket.io to the API
// host. First-party handshake means the session cookie rides along for auth.

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@ama-midi/shared";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// "" → same origin (io() connects to window.location). Set VITE_API_URL to
// target a remote API host directly.
const API_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";

/** Lazily-created singleton — connect() is called by the useSocket hook. */
let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    // Empty string → connect to same origin (undefined lets socket.io default to window.location).
    socket = io(API_URL || undefined, {
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
