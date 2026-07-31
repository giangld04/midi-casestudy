// Embedding service: generates 768-dim text embeddings via Gemini gemini-embedding-001.
// The model natively outputs 3072 dims; we request 768 via outputDimensionality to match
// the pgvector vector(768) column. Cosine distance (<=>) normalizes internally, so the
// non-unit-length truncated vectors are fine for cosine ranking.
// Returns null on any error so callers can fall back gracefully (ILIKE search, etc.).
// Fire-and-forget pattern: callers must NOT await the embedding update for request latency.
import { GoogleGenAI } from "@google/genai";
import type { SongDto } from "./song-service";

const MODEL = "gemini-embedding-001";
const OUTPUT_DIM = 768;

/** Lazy singleton — only constructed when key is present. */
let _ai: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) return null;
  if (!_ai) _ai = new GoogleGenAI({ apiKey: key });
  return _ai;
}

/**
 * Build the text to embed for a song.
 * Combines title + description (if present).
 */
export function buildSongEmbeddingText(song: Pick<SongDto, "title" | "description">): string {
  const parts = [song.title];
  if (song.description) parts.push(song.description);
  return parts.join(" — ");
}

/**
 * Generate a 768-dim embedding for the given text using Gemini text-embedding-004.
 * Returns null if: key missing, API error, or unexpected response shape.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const ai = getClient();
  if (!ai) return null;

  try {
    const response = await ai.models.embedContent({
      model: MODEL,
      contents: text,
      config: { outputDimensionality: OUTPUT_DIM },
    });
    const values = response.embeddings?.[0]?.values;
    if (!values || values.length !== OUTPUT_DIM) return null;
    return values;
  } catch (err) {
    console.error("[embedding-service] Gemini embedContent error:", err);
    return null;
  }
}
