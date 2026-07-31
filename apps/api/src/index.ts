// AMA-MIDI API server — Express + TypeScript.
// Middleware order (CRITICAL):
//   CORS → Better Auth handler → express.json → CSRF → protected routes (requireAuth → rateLimiter)
// Better Auth needs raw body access, so it mounts BEFORE express.json().
// rateLimiter is applied per protected-route chain AFTER requireAuth so it can key by user id.
import "dotenv/config";
import { createServer } from "http";
import express, { type Express } from "express";
import cors from "cors";
import type { ApiResponse } from "@ama-midi/shared";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth/auth-config";
import { songRouter } from "./routes/song-routes";
import { noteRouter } from "./routes/note-routes";
import { searchRouter } from "./routes/search-routes";
import { errorHandler } from "./middleware/error-handler";
import { requireAuth } from "./middleware/require-auth";
import { rateLimiter } from "./middleware/rate-limiter";
import { csrfProtection } from "./middleware/csrf-protection";
import { createSocketServer } from "./socket/socket-server";

const app: Express = express();
const PORT = process.env["PORT"] ?? 3000;

// CORS — must allow credentials for cookie-based sessions.
// Wildcard "*" is incompatible with credentials:true, so always use an explicit origin.
const corsOrigin = process.env["CORS_ORIGIN"] ?? "http://localhost:5173";
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

// Mount Better Auth BEFORE express.json() — BA reads raw body internally.
// Handles all /api/auth/* routes (sign-up, sign-in, sign-out, callback, session, etc.)
app.all("/api/auth/*", toNodeHandler(auth));

// JSON body parsing for all routes below this point
app.use(express.json());

// CSRF protection for mutating methods
app.use(csrfProtection);

// Health check endpoint — public, no auth required
app.get("/health", (_req, res) => {
  const response: ApiResponse<{ ts: string }> = {
    ok: true,
    data: { ts: new Date().toISOString() },
  };
  res.json(response);
});

// Protected resource routes. Order per chain: requireAuth → rateLimiter → router.
// rateLimiter runs AFTER requireAuth so req.user is populated → the per-user
// 100/15min limit is reachable (IP-keyed 30/15min fallback for any unauth leak-through).
// IMPORTANT: /api/songs/search MUST be mounted before /api/songs so the literal
// path "search" is not captured by the /:id param route inside songRouter.
app.use("/api/songs/search", requireAuth, rateLimiter, searchRouter);
app.use("/api/songs", requireAuth, rateLimiter, songRouter);
app.use("/api/notes", requireAuth, rateLimiter, noteRouter);

// Global error handler — must be registered after routes
app.use(errorHandler);

// Start the runtime server unless imported for testing. Socket.io + its Redis
// connections are created here (not at module load) so REST integration tests —
// which import `app` via supertest — don't spawn leaked WebSocket/Redis handles.
if (process.env["NODE_ENV"] !== "test") {
  const httpServer = createServer(app);
  createSocketServer(httpServer);
  httpServer.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`);
  });
}

export { app };
