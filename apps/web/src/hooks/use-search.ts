/**
 * Debounced semantic search hook.
 * Calls GET /api/songs/search?q=...&limit=10 with 300ms debounce.
 * Returns results, loading state, and any error.
 */

import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api-client";

export interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  /** Cosine similarity [0,1], null for ILIKE fallback results */
  similarity: number | null;
}

export interface UseSearch {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  query: string;
  setQuery: (q: string) => void;
  clear: () => void;
}

const DEBOUNCE_MS = 300;

export function useSearch(): UseSearch {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear previous timer on each keystroke
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch<SearchResult[]>(
          `/api/songs/search?q=${encodeURIComponent(trimmed)}&limit=10`,
        );
        setResults(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  return {
    results,
    loading,
    error,
    query,
    setQuery,
    clear: () => {
      setQuery("");
      setResults([]);
    },
  };
}
