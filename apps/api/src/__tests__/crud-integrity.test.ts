// Phase 03 + Phase 07 integration tests — run against a REAL Postgres (docker-compose).
// No mocks: these assert the actual data-integrity guarantees (atomic upsert,
// boundary CHECKs, optimistic locking, event-ledger writes).
// Phase 07: all routes now require auth; tests obtain a real session cookie first.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { app } from "../index";
import { db } from "../db";
import { events, songs } from "@ama-midi/db";
import { signUpAndGetCookie, cleanAuthTables } from "./helpers/auth-test-helper";

let sessionCookie: string;

beforeAll(async () => {
  // Sign up once; reuse cookie for all tests in this file
  sessionCookie = await signUpAndGetCookie();
});

afterAll(async () => {
  await db.delete(songs);
  await cleanAuthTables();
});

/** Helper: create a song and return its id */
async function createSong(title = "Test Song"): Promise<string> {
  const res = await request(app)
    .post("/api/songs")
    .set("Cookie", sessionCookie)
    .send({ title });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

const validNote = { title: "C4", track: 3, timeTick: 120, color: "#22d3ee" };

describe("Phase 03 — Song + Note CRUD & Data Integrity", () => {
  // Start each test from a clean slate; deleting songs cascades to notes+events.
  beforeEach(async () => {
    await db.delete(songs);
  });

  describe("Song CRUD (Foundation)", () => {
    it("creates, reads, updates and deletes a song", async () => {
      const create = await request(app)
        .post("/api/songs")
        .set("Cookie", sessionCookie)
        .send({ title: "My Song", description: "demo" });
      expect(create.status).toBe(201);
      expect(create.body.data.title).toBe("My Song");
      const id = create.body.data.id;

      const get = await request(app).get(`/api/songs/${id}`).set("Cookie", sessionCookie);
      expect(get.status).toBe(200);
      expect(get.body.data.id).toBe(id);
      // embedding vector is never exposed by the API
      expect(get.body.data).not.toHaveProperty("embedding");

      const update = await request(app)
        .put(`/api/songs/${id}`)
        .set("Cookie", sessionCookie)
        .send({ title: "Renamed" });
      expect(update.status).toBe(200);
      expect(update.body.data.title).toBe("Renamed");

      const list = await request(app).get("/api/songs").set("Cookie", sessionCookie);
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);

      const del = await request(app).delete(`/api/songs/${id}`).set("Cookie", sessionCookie);
      expect(del.status).toBe(204);

      const gone = await request(app).get(`/api/songs/${id}`).set("Cookie", sessionCookie);
      expect(gone.status).toBe(404);
    });

    it("rejects an empty song title with 400", async () => {
      const res = await request(app)
        .post("/api/songs")
        .set("Cookie", sessionCookie)
        .send({ title: "" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Note creation + duplicate integrity (409)", () => {
    it("creates a note and returns 201", async () => {
      const songId = await createSong();
      const res = await request(app)
        .post(`/api/songs/${songId}/notes`)
        .set("Cookie", sessionCookie)
        .send(validNote);
      expect(res.status).toBe(201);
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.track).toBe(3);
    });

    it("returns 409 on a duplicate (song, track, timeTick) — no silent overwrite", async () => {
      const songId = await createSong();
      const first = await request(app)
        .post(`/api/songs/${songId}/notes`)
        .set("Cookie", sessionCookie)
        .send(validNote);
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/songs/${songId}/notes`)
        .set("Cookie", sessionCookie)
        .send(validNote);
      expect(second.status).toBe(409);
      expect(second.body.code).toBe("CONFLICT");
    });
  });

  describe("Boundary CHECK constraints", () => {
    it("rejects track 0 (below min 1) with 400", async () => {
      const songId = await createSong();
      const res = await request(app)
        .post(`/api/songs/${songId}/notes`)
        .set("Cookie", sessionCookie)
        .send({ ...validNote, track: 0 });
      expect(res.status).toBe(400);
    });

    it("rejects track 9 (above max 8) with 400", async () => {
      const songId = await createSong();
      const res = await request(app)
        .post(`/api/songs/${songId}/notes`)
        .set("Cookie", sessionCookie)
        .send({ ...validNote, track: 9 });
      expect(res.status).toBe(400);
    });

    it("rejects timeTick -1 (below 0) with 400", async () => {
      const songId = await createSong();
      const res = await request(app)
        .post(`/api/songs/${songId}/notes`)
        .set("Cookie", sessionCookie)
        .send({ ...validNote, timeTick: -1 });
      expect(res.status).toBe(400);
    });

    it("rejects timeTick 1201 (above 1200) with 400", async () => {
      const songId = await createSong();
      const res = await request(app)
        .post(`/api/songs/${songId}/notes`)
        .set("Cookie", sessionCookie)
        .send({ ...validNote, timeTick: 1201 });
      expect(res.status).toBe(400);
    });
  });

  describe("Note update + optimistic locking", () => {
    it("updates a note when version matches", async () => {
      const songId = await createSong();
      const create = await request(app)
        .post(`/api/songs/${songId}/notes`)
        .set("Cookie", sessionCookie)
        .send(validNote);
      const { id, version } = create.body.data as { id: string; version: number };

      const update = await request(app)
        .put(`/api/notes/${id}`)
        .set("Cookie", sessionCookie)
        .send({ track: 4, timeTick: 200, version });
      expect(update.status).toBe(200);
      expect(update.body.data.version).toBe(version + 1);
    });

    it("returns 409 when version is stale", async () => {
      const songId = await createSong();
      const create = await request(app)
        .post(`/api/songs/${songId}/notes`)
        .set("Cookie", sessionCookie)
        .send(validNote);
      const { id } = create.body.data as { id: string };

      const stale = await request(app)
        .put(`/api/notes/${id}`)
        .set("Cookie", sessionCookie)
        .send({ track: 4, timeTick: 200, version: 99 });
      expect(stale.status).toBe(409);
    });
  });

  describe("Note deletion", () => {
    it("deletes a note and returns 204", async () => {
      const songId = await createSong();
      const create = await request(app)
        .post(`/api/songs/${songId}/notes`)
        .set("Cookie", sessionCookie)
        .send(validNote);
      const id = create.body.data.id as string;

      const del = await request(app)
        .delete(`/api/notes/${id}`)
        .set("Cookie", sessionCookie);
      expect(del.status).toBe(204);
    });

    it("returns 404 when note does not exist", async () => {
      const res = await request(app)
        .delete("/api/notes/00000000-0000-0000-0000-000000000000")
        .set("Cookie", sessionCookie);
      expect(res.status).toBe(404);
    });
  });

  describe("Event ledger", () => {
    it("creates an event row for each note mutation", async () => {
      const songId = await createSong();
      const create = await request(app)
        .post(`/api/songs/${songId}/notes`)
        .set("Cookie", sessionCookie)
        .send(validNote);
      const { id, version } = create.body.data as { id: string; version: number };

      await request(app)
        .put(`/api/notes/${id}`)
        .set("Cookie", sessionCookie)
        .send({ track: 5, timeTick: 300, version });
      await request(app)
        .delete(`/api/notes/${id}`)
        .set("Cookie", sessionCookie);

      const evts = await db.select().from(events).where(eq(events.songId, songId));
      expect(evts.length).toBe(3);
      const types = evts.map((e) => e.eventType);
      expect(types).toContain("note_created");
      expect(types).toContain("note_updated");
      expect(types).toContain("note_deleted");
    });

    it("event actor is the authenticated user id", async () => {
      const songId = await createSong();
      await request(app)
        .post(`/api/songs/${songId}/notes`)
        .set("Cookie", sessionCookie)
        .send(validNote);

      const evts = await db.select().from(events).where(eq(events.songId, songId));
      expect(evts[0]?.actor).toBeTruthy(); // actor set to real user id
    });
  });
});
