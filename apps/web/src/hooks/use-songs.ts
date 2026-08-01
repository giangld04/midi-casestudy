/**
 * Hook for song CRUD — fetches list, creates, selects, and updates songs.
 * State: all songs + currently-selected song id.
 */

import { useState, useEffect, useCallback } from "react";
import type { Song } from "@ama-midi/shared";
import { apiFetch } from "@/lib/api-client";

export interface UseSongs {
  songs: Song[];
  selectedSongId: string | null;
  loading: boolean;
  error: string | null;
  selectSong: (id: string) => void;
  createSong: (title: string, description?: string) => Promise<Song | null>;
  deleteSong: (id: string) => Promise<boolean>;
  refresh: () => void;
}

export function useSongs(): UseSongs {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSongs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Song[]>("/api/songs");
      setSongs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load songs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSongs();
  }, [fetchSongs]);

  const createSong = useCallback(
    async (title: string, description?: string): Promise<Song | null> => {
      try {
        const song = await apiFetch<Song>("/api/songs", {
          method: "POST",
          body: JSON.stringify({ title, description }),
        });
        setSongs((prev) => [...prev, song]);
        return song;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create song");
        return null;
      }
    },
    []
  );

  const deleteSong = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await apiFetch<void>(`/api/songs/${id}`, { method: "DELETE" });
        setSongs((prev) => prev.filter((s) => s.id !== id));
        // Clear selection if the deleted song was selected
        setSelectedSongId((cur) => (cur === id ? null : cur));
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete song");
        return false;
      }
    },
    []
  );

  return {
    songs,
    selectedSongId,
    loading,
    error,
    selectSong: setSelectedSongId,
    createSong,
    deleteSong,
    refresh: () => void fetchSongs(),
  };
}
