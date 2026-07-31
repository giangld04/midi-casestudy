// Phase 05 + Phase 07 integration tests — real Postgres + real Socket.io server (no mocks).
// Spins up an HTTP+Socket.io server on an ephemeral port and drives it with two
// socket.io-client connections to assert broadcast, presence, and conflict
// rejection behaviour end-to-end.
// Phase 07: every socket connection now requires a valid session cookie.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { io as ClientIO, type Socket as ClientSocket } from "socket.io-client";
import request from "supertest";
import { app } from "../index";
import { db } from "../db";
import { notes, songs } from "@ama-midi/db";
import { createSocketServer, type AppIO } from "../socket/socket-server";
import { signUpAndGetCookie, cookieHeader, cleanAuthTables } from "./helpers/auth-test-helper";

let httpServer: HttpServer;
let ioServer: AppIO;
let url: string;
// Single shared session cookie for all socket connections in this file
let sessionCookieRaw: string;
let sessionCookieHeader: string;

beforeAll(async () => {
  httpServer = createServer(app);
  ioServer = createSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  url = `http://localhost:${port}`;

  // Sign up once; all test sockets use this session
  sessionCookieRaw = await signUpAndGetCookie();
  sessionCookieHeader = cookieHeader(sessionCookieRaw);
});

afterAll(async () => {
  await ioServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await db.delete(songs);
  await cleanAuthTables();
});

let songId: string;
const clients: ClientSocket[] = [];

beforeEach(async () => {
  await db.delete(songs);
  // Insert via REST (with auth) so we also test that path
  const res = await request(app)
    .post("/api/songs")
    .set("Cookie", sessionCookieRaw)
    .send({ title: "Collab Song" });
  songId = res.body.data.id as string;
});

afterEach(() => {
  for (const c of clients) c.disconnect();
  clients.length = 0;
});

/** Connect a new authenticated client and resolve once the WebSocket is established. */
function connect(): Promise<ClientSocket> {
  const socket = ClientIO(url, {
    transports: ["websocket"],
    forceNew: true,
    extraHeaders: { cookie: sessionCookieHeader },
  });
  clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => reject(err));
  });
}

/** Resolve with the next payload for an event, or reject after `ms`. */
function once<T>(socket: ClientSocket, event: string, ms = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Join `songId` and wait until presence reflects `expectedCount` members. */
function joinAndWait(socket: ClientSocket, expectedCount: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for presence")), 4000);
    const onPresence = (p: { users: unknown[] }) => {
      if (p.users.length >= expectedCount) {
        clearTimeout(timer);
        socket.off("presence:update", onPresence);
        resolve();
      }
    };
    socket.on("presence:update", onPresence);
    socket.emit("join-song", { songId });
  });
}

describe("Phase 05 — Real-Time Collaboration", () => {
  it("broadcasts a created note to other room members", async () => {
    const a = await connect();
    const b = await connect();
    await joinAndWait(a, 1);
    await joinAndWait(b, 2);

    const received = once<{ note: { track: number; timeTick: number }; reqId: string }>(
      b,
      "note:created",
    );
    a.emit("note:create", {
      songId,
      reqId: "req-a-1",
      title: "C4",
      track: 3,
      timeTick: 120,
      color: "#22d3ee",
    });

    const { note, reqId } = await received;
    expect(note.track).toBe(3);
    expect(note.timeTick).toBe(120);
    expect(reqId).toBe("req-a-1");
  });

  it("reports presence count as users join and leave", async () => {
    const a = await connect();
    await joinAndWait(a, 1);

    const b = await connect();
    const presenceAfterJoin = once<{ users: unknown[] }>(a, "presence:update");
    b.emit("join-song", { songId });
    expect((await presenceAfterJoin).users.length).toBe(2);

    const presenceAfterLeave = once<{ users: unknown[] }>(a, "presence:update");
    b.emit("leave-song", { songId });
    expect((await presenceAfterLeave).users.length).toBe(1);
  });

  it("rejects a duplicate grid cell with a CONFLICT and does not double-insert", async () => {
    const a = await connect();
    const b = await connect();
    await joinAndWait(a, 1);
    await joinAndWait(b, 2);

    // A creates first; wait for the authoritative broadcast to land
    const created = once(a, "note:created");
    a.emit("note:create", {
      songId,
      reqId: "req-a-1",
      title: "C4",
      track: 3,
      timeTick: 120,
    });
    await created;

    // B attempts the SAME cell → server rejects only the sender
    const rejected = once<{ code: string; reqId: string }>(b, "note:rejected");
    b.emit("note:create", {
      songId,
      reqId: "req-b-1",
      title: "dup",
      track: 3,
      timeTick: 120,
    });
    const rej = await rejected;
    expect(rej.code).toBe("CONFLICT");
    expect(rej.reqId).toBe("req-b-1");

    const rows = await db.select().from(notes);
    expect(rows).toHaveLength(1);
  });

  it("rejects a stale-version update (optimistic lock)", async () => {
    const a = await connect();
    await joinAndWait(a, 1);

    const created = once<{ note: { id: string; version: number } }>(a, "note:created");
    a.emit("note:create", { songId, reqId: "c1", title: "n", track: 2, timeTick: 40 });
    const { note } = await created;

    // First move with the correct version succeeds
    const updated = once<{ note: { version: number } }>(a, "note:updated");
    a.emit("note:update", {
      songId,
      reqId: "u1",
      noteId: note.id,
      track: 2,
      timeTick: 44,
      version: note.version,
    });
    expect((await updated).note.version).toBe(note.version + 1);

    // Second move re-using the STALE version is rejected
    const rejected = once<{ code: string }>(a, "note:rejected");
    a.emit("note:update", {
      songId,
      reqId: "u2",
      noteId: note.id,
      track: 2,
      timeTick: 48,
      version: note.version, // stale
    });
    expect((await rejected).code).toBe("CONFLICT");
  });

  it("forbids mutations from a socket that never joined the room", async () => {
    const rogue = await connect(); // connected but never emits join-song

    const rejected = once<{ code: string; reqId: string }>(rogue, "note:rejected");
    rogue.emit("note:create", {
      songId,
      reqId: "rogue-1",
      title: "sneaky",
      track: 5,
      timeTick: 200,
    });
    const rej = await rejected;
    expect(rej.code).toBe("FORBIDDEN");
    expect(rej.reqId).toBe("rogue-1");

    const rows = await db.select().from(notes);
    expect(rows).toHaveLength(0);
  });

  it("broadcasts note deletion to the room", async () => {
    const a = await connect();
    const b = await connect();
    await joinAndWait(a, 1);
    await joinAndWait(b, 2);

    const created = once<{ note: { id: string } }>(a, "note:created");
    a.emit("note:create", { songId, reqId: "c1", title: "n", track: 1, timeTick: 8 });
    const { note } = await created;

    const deleted = once<{ noteId: string }>(b, "note:deleted");
    a.emit("note:delete", { songId, reqId: "d1", noteId: note.id });
    expect((await deleted).noteId).toBe(note.id);

    const rows = await db.select().from(notes);
    expect(rows).toHaveLength(0);
  });
});
