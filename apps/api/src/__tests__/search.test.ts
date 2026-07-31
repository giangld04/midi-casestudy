// Phase 08 — Semantic Search integration tests.
// Runs against real Postgres (docker-compose). No mocks.
//
// Tests:
//  (a) buildSongEmbeddingText — pure unit test
//  (b) vector ordering — insert songs with known embeddings, verify cosine order
//  (c) ILIKE fallback — when GEMINI_API_KEY absent at call-time
//  (d) route auth — unauthenticated GET /api/songs/search → 401
//  (e) [gated] end-to-end real Gemini test (skipped if no GEMINI_API_KEY)

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Pool } from "pg";
import { app } from "../index";
import { db } from "../db";
import { songs } from "@ama-midi/db";
import { buildSongEmbeddingText } from "../services/embedding-service";
import { searchSongs } from "../services/search-service";
import { signUpAndGetCookie, cleanAuthTables } from "./helpers/auth-test-helper";

// ── Helpers ──────────────────────────────────────────────────────────────────

let pool: Pool;
let sessionCookie: string;

/** Insert a song row with a pre-built embedding vector directly via SQL */
async function insertSongWithEmbedding(
  title: string,
  embedding: number[],
): Promise<string> {
  const vectorLiteral = `[${embedding.join(",")}]`;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO songs (title, embedding) VALUES ($1, $2::vector) RETURNING id`,
    [title, vectorLiteral],
  );
  return rows[0]!.id;
}

/** Build a 768-dim zero vector with a 1 at position `pos` */
function unitVector(pos: number): number[] {
  const v = new Array<number>(768).fill(0);
  v[pos] = 1;
  return v;
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL required");
  pool = new Pool({ connectionString: url });
  sessionCookie = await signUpAndGetCookie();
});

afterAll(async () => {
  await db.delete(songs);
  await cleanAuthTables();
  await pool.end();
});

// ── (a) Pure unit: buildSongEmbeddingText ───────────────────────────────────

describe("buildSongEmbeddingText", () => {
  it("returns title only when description is absent", () => {
    const text = buildSongEmbeddingText({ title: "Boss Fight", description: null });
    expect(text).toBe("Boss Fight");
  });

  it("concatenates title and description with separator", () => {
    const text = buildSongEmbeddingText({
      title: "Boss Fight",
      description: "energetic battle music",
    });
    expect(text).toBe("Boss Fight — energetic battle music");
  });

  it("handles empty description string same as absent", () => {
    const text = buildSongEmbeddingText({ title: "Intro", description: "" });
    // empty string is falsy — treated as no description
    expect(text).toBe("Intro");
  });
});

// ── (b) Vector ordering test ─────────────────────────────────────────────────

describe("searchSongs — vector ordering", () => {
  it("returns songs ordered by cosine similarity to query vector", async () => {
    // Song A: embedding with 1 at position 0  → similar to queries near dim 0
    // Song B: embedding with 1 at position 1  → similar to queries near dim 1
    const idA = await insertSongWithEmbedding("Song Alpha", unitVector(0));
    const idB = await insertSongWithEmbedding("Song Beta", unitVector(1));

    // Query embedding near position 0 → Song Alpha should rank first
    // We call searchSongs with a known vector by temporarily patching the
    // generateEmbedding function via the module's exported seam.
    // Instead, we test the SQL ordering directly by calling searchSongs with
    // an env where we inject a known embedding — we do this by calling the
    // internal vectorSearch path through a raw pool query to validate ordering.
    const queryVector = unitVector(0);
    const vectorLiteral = `[${queryVector.join(",")}]`;

    // The IVFFlat index (lists=100) is APPROXIMATE: it scans only `ivfflat.probes`
    // lists (default 1). With few, scattered rows the planner may use the index and
    // miss a row in an un-probed list. This test asserts exact cosine ordering, so
    // probe every list on a dedicated connection to force full recall (deterministic).
    const client = await pool.connect();
    let rows: { id: string; distance: string }[];
    try {
      await client.query("SET ivfflat.probes = 100");
      ({ rows } = await client.query<{ id: string; distance: string }>(
        `SELECT id, (embedding <=> $1::vector) AS distance
         FROM songs
         WHERE embedding IS NOT NULL
         ORDER BY distance
         LIMIT 10`,
        [vectorLiteral],
      ));
    } finally {
      client.release();
    }

    const ids = rows.map((r) => r.id);
    // Alpha (dim 0) must rank before Beta (dim 1) when querying near dim 0
    expect(ids.indexOf(idA)).toBeLessThan(ids.indexOf(idB));

    // Verify distance ordering is ascending
    const distances = rows.map((r) => parseFloat(r.distance));
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]!).toBeGreaterThanOrEqual(distances[i - 1]!);
    }
  });
});

// ── (c) ILIKE fallback when embedding generation returns null ─────────────────

describe("searchSongs — ILIKE fallback", () => {
  it("finds songs by title keyword when GEMINI_API_KEY is unset", async () => {
    // Insert a song without embedding
    await pool.query(`INSERT INTO songs (title, description) VALUES ($1, $2)`, [
      "Legendary Battle Theme",
      "An epic orchestral piece",
    ]);

    // Temporarily remove the key so generateEmbedding returns null
    const savedKey = process.env["GEMINI_API_KEY"];
    delete process.env["GEMINI_API_KEY"];

    try {
      const results = await searchSongs("Legendary Battle", 10);
      const titles = results.map((r) => r.title);
      expect(titles).toContain("Legendary Battle Theme");
      // ILIKE fallback → similarity is null
      const target = results.find((r) => r.title === "Legendary Battle Theme");
      expect(target?.similarity).toBeNull();
    } finally {
      if (savedKey !== undefined) {
        process.env["GEMINI_API_KEY"] = savedKey;
      }
    }
  });
});

// ── (d) Route auth: unauthenticated request → 401 ────────────────────────────

describe("GET /api/songs/search — auth", () => {
  it("returns 401 when no session cookie is sent", async () => {
    const res = await request(app).get("/api/songs/search?q=test");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when q is missing", async () => {
    const res = await request(app)
      .get("/api/songs/search")
      .set("Cookie", sessionCookie);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 200 with results array for authenticated request", async () => {
    const res = await request(app)
      .get("/api/songs/search?q=test")
      .set("Cookie", sessionCookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ── (e) End-to-end Gemini test (gated on GEMINI_API_KEY) ─────────────────────

const GEMINI_KEY_PRESENT = !!process.env["GEMINI_API_KEY"];

describe.skipIf(!GEMINI_KEY_PRESENT)(
  "searchSongs — end-to-end Gemini (requires GEMINI_API_KEY)",
  () => {
    it("creates a song, waits for embedding, then finds it via semantic search", async () => {
      // Create song via API so the auto-embed is triggered
      const createRes = await request(app)
        .post("/api/songs")
        .set("Cookie", sessionCookie)
        .send({
          title: "Epic Boss Fight",
          description: "Intense high-energy battle music with drums and strings",
        });
      expect(createRes.status).toBe(201);
      const songId = createRes.body.data.id as string;

      // Wait for the async fire-and-forget embedding to complete (max 10s)
      let embedded = false;
      for (let i = 0; i < 20; i++) {
        const { rows } = await pool.query<{ has_embedding: boolean }>(
          `SELECT (embedding IS NOT NULL) AS has_embedding FROM songs WHERE id = $1`,
          [songId],
        );
        if (rows[0]?.has_embedding) {
          embedded = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(embedded).toBe(true);

      // Semantic search with natural language — should return the song
      const results = await searchSongs("energetic battle music", 10);
      const ids = results.map((r) => r.id);
      expect(ids).toContain(songId);

      // Similarity score should be present and positive
      const target = results.find((r) => r.id === songId);
      expect(target?.similarity).not.toBeNull();
      expect(target!.similarity!).toBeGreaterThan(0);
    });
  },
);
