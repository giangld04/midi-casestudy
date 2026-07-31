-- Phase 08: IVFFlat index for fast pgvector cosine similarity search on songs.embedding.
-- lists=100 is appropriate for up to ~1M rows; rebuild with more lists at larger scale.
-- The index only covers rows WHERE embedding IS NOT NULL (partial index not supported by
-- ivfflat, but the search query already filters on IS NOT NULL for efficiency).
CREATE INDEX IF NOT EXISTS idx_songs_embedding_ivfflat
    ON songs
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
