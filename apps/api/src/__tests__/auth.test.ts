// Phase 07 auth integration tests — real Better Auth sessions, no mocks.
// Tests: unauthenticated rejection, sign-up+sign-in flow, socket auth.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { io as ClientIO, type Socket as ClientSocket } from "socket.io-client";
import request from "supertest";
import { app } from "../index";
import { db } from "../db";
import { songs } from "@ama-midi/db";
import { createSocketServer, type AppIO } from "../socket/socket-server";
import { signUpAndGetCookie, cookieHeader, cleanAuthTables } from "./helpers/auth-test-helper";

// ── REST auth tests ─────────────────────────────────────────────────────────

describe("Phase 07 — Auth: REST endpoints", () => {
  afterAll(async () => {
    await db.delete(songs);
    await cleanAuthTables();
  });

  it("unauthenticated GET /api/songs returns 401", async () => {
    const res = await request(app).get("/api/songs");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("unauthenticated POST /api/songs returns 401", async () => {
    const res = await request(app).post("/api/songs").send({ title: "no-auth" });
    expect(res.status).toBe(401);
  });

  it("sign-up → authenticated GET /api/songs returns 200", async () => {
    const cookie = await signUpAndGetCookie();
    const res = await request(app).get("/api/songs").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("sign-in with existing account returns session cookie", async () => {
    const email = `signin-${Date.now()}@example.com`;
    const password = "SignIn1234!";

    // First sign up
    await request(app)
      .post("/api/auth/sign-up/email")
      .send({ email, password, name: "Sign In User" });

    // Then sign in
    const signinRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password });

    expect(signinRes.status).toBe(200);
    const cookies = signinRes.headers["set-cookie"];
    expect(cookies).toBeTruthy();

    // Cookie should grant access
    const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : String(cookies);
    const apiRes = await request(app).get("/api/songs").set("Cookie", cookieStr);
    expect(apiRes.status).toBe(200);
  });

  it("/health is public (no auth required)", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("sign-out invalidates the session server-side → same cookie returns 401", async () => {
    const cookie = await signUpAndGetCookie();

    // Cookie grants access before sign-out
    const before = await request(app).get("/api/songs").set("Cookie", cookie);
    expect(before.status).toBe(200);

    // Sign out — Better Auth deletes the session row for this cookie
    const signOut = await request(app).post("/api/auth/sign-out").set("Cookie", cookie);
    expect(signOut.status).toBe(200);

    // Re-using the now-invalidated cookie must be rejected
    const after = await request(app).get("/api/songs").set("Cookie", cookie);
    expect(after.status).toBe(401);
    expect(after.body.code).toBe("UNAUTHORIZED");
  });
});

// ── Socket auth tests ────────────────────────────────────────────────────────

let httpServer: HttpServer;
let ioServer: AppIO;
let url: string;
const clients: ClientSocket[] = [];

beforeAll(async () => {
  httpServer = createServer(app);
  ioServer = createSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  url = `http://localhost:${port}`;
});

afterAll(async () => {
  for (const c of clients) c.disconnect();
  clients.length = 0;
  await ioServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await db.delete(songs);
  await cleanAuthTables();
});

describe("Phase 07 — Auth: Socket.io", () => {
  it("socket connection without cookie is rejected", async () => {
    const socket = ClientIO(url, { transports: ["websocket"], forceNew: true });
    clients.push(socket);

    const error = await new Promise<string>((resolve) => {
      socket.on("connect_error", (err) => resolve(err.message));
      // If somehow connected, fail
      socket.on("connect", () => resolve("connected-unexpectedly"));
    });

    expect(error).toContain("UNAUTHORIZED");
  });

  it("socket with valid session cookie connects successfully", async () => {
    const cookies = await signUpAndGetCookie();
    const cookieStr = cookieHeader(cookies);

    const socket = ClientIO(url, {
      transports: ["websocket"],
      forceNew: true,
      extraHeaders: { cookie: cookieStr },
    });
    clients.push(socket);

    const connected = await new Promise<boolean>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout waiting for connect")), 5000);
      socket.on("connect", () => {
        clearTimeout(timer);
        resolve(true);
      });
      socket.on("connect_error", (err) => {
        clearTimeout(timer);
        reject(new Error(`connect_error: ${err.message}`));
      });
    });

    expect(connected).toBe(true);
  });

  it("socket with valid cookie can join a song room", async () => {
    const cookies = await signUpAndGetCookie();
    const cookieStr = cookieHeader(cookies);

    // Create a song to join
    const songRes = await request(app)
      .post("/api/songs")
      .set("Cookie", cookies)
      .send({ title: "Socket Auth Test Song" });
    const songId = songRes.body.data.id as string;

    const socket = ClientIO(url, {
      transports: ["websocket"],
      forceNew: true,
      extraHeaders: { cookie: cookieStr },
    });
    clients.push(socket);

    // Wait for connect + presence update after joining
    const presence = await new Promise<{ users: unknown[] }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 5000);
      socket.on("connect", () => {
        socket.on("presence:update", (data) => {
          clearTimeout(timer);
          resolve(data);
        });
        socket.emit("join-song", { songId });
      });
      socket.on("connect_error", (err) => {
        clearTimeout(timer);
        reject(new Error(`connect_error: ${err.message}`));
      });
    });

    expect(presence.users.length).toBeGreaterThan(0);
  });
});
