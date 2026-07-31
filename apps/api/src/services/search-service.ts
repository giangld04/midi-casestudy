// Search service: semantic song search via pgvector cosine distance (<=>) with
// automatic ILIKE text-search fallback when Gemini is unavailable.
// All queries are parameterized — no SQL injection risk.
import { Pool } from "pg";
import { generateEmbedding } from "./embedding-service";

/** Song result shape returned by both vector and ILIKE search paths */
export interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Cosine similarity [0,1]. Null for ILIKE fallback results. */
  similarity: number | null;
}

/** Cached pg Pool for raw SQL needed by pgvector <=> operator. */
let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL environment variable is required");
  _pool = new Pool({ connectionString: url });
  return _pool;
}

/**
 * Convert a float array to pgvector literal string "[a,b,c,...]".
 * Safe: only numbers pass — no user input reaches this function.
 */
function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

/**
 * Search songs by semantic similarity.
 * - If Gemini embedding succeeds: pgvector cosine distance on songs with embeddings.
 * - Fallback (embedding = null): ILIKE on title + description.
 * Songs without embeddings are excluded from vector results but included in fallback.
 */
export async function searchSongs(
  query: string,
  limit = 10,
): Promise<SearchResult[]> {
  const embedding = await generateEmbedding(query);

  if (embedding) {
    return vectorSearch(embedding, limit);
  }
  return ilikeSearch(query, limit);
}

/** pgvector cosine distance search — lower distance = more similar */
async function vectorSearch(embedding: number[], limit: number): Promise<SearchResult[]> {
  const pool = getPool();
  const vectorLiteral = toVectorLiteral(embedding);

  // Cast the literal string to vector type in the query
  const { rows } = await pool.query<{
    id: string;
    title: string;
    description: string | null;
    created_at: Date;
    updated_at: Date;
    distance: string;
  }>(
    `SELECT id, title, description, created_at, updated_at,
            (embedding <=> $1::vector) AS distance
     FROM songs
     WHERE embedding IS NOT NULL
     ORDER BY distance
     LIMIT $2`,
    [vectorLiteral, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // similarity = 1 - cosine_distance (pgvector cosine distance is in [0,2])
    similarity: Math.max(0, 1 - parseFloat(row.distance)),
  }));
}

/** Text ILIKE fallback — used when Gemini is unavailable */
async function ilikeSearch(query: string, limit: number): Promise<SearchResult[]> {
  const pool = getPool();

  const { rows } = await pool.query<{
    id: string;
    title: string;
    description: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, title, description, created_at, updated_at
     FROM songs
     WHERE title ILIKE '%' || $1 || '%'
        OR description ILIKE '%' || $1 || '%'
     ORDER BY created_at DESC
     LIMIT $2`,
    [query, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    similarity: null,
  }));
}
