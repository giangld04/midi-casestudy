/**
 * Hook for note CRUD against a single song.
 * Implements optimistic-locking: drag-move sends `version`, reverts on 409.
 */

import { useState, useEffect, useCallback } from "react";
import type { Note } from "@ama-midi/shared";
import { apiFetch, ApiError } from "@/lib/api-client";
import { trackColor } from "@/lib/colors";

export interface MovePayload {
  track: number;
  timeTick: number;
}

export interface UseNotes {
  notes: Note[];
  loading: boolean;
  error: string | null;
  statusMessage: string | null;
  createNote: (track: number, timeTick: number) => Promise<void>;
  moveNote: (note: Note, to: MovePayload) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
}

export function useNotes(songId: string | null): UseNotes {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Briefly show a non-blocking status message then clear it
  const flash = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 2500);
  }, []);

  // Fetch notes whenever the selected song changes
  useEffect(() => {
    if (!songId) {
      setNotes([]);
      return;
    }
    setLoading(true);
    setError(null);
    apiFetch<Note[]>(`/api/songs/${songId}/notes`)
      .then(setNotes)
      .catch((err) => setError(err instanceof Error ? err.message : "Error"))
      .finally(() => setLoading(false));
  }, [songId]);

  const createNote = useCallback(
    async (track: number, timeTick: number) => {
      if (!songId) return;
      try {
        const note = await apiFetch<Note>(`/api/songs/${songId}/notes`, {
          method: "POST",
          body: JSON.stringify({
            title: "Note",
            track,
            timeTick,
            color: trackColor(track),
          }),
        });
        setNotes((prev) => [...prev, note]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Create failed";
        setError(msg);
        flash(msg);
      }
    },
    [songId, flash]
  );

  const moveNote = useCallback(
    async (note: Note, to: MovePayload) => {
      // Optimistically update local state
      setNotes((prev) =>
        prev.map((n) =>
          n.id === note.id ? { ...n, track: to.track as Note["track"], timeTick: to.timeTick } : n
        )
      );
      try {
        const updated = await apiFetch<Note>(`/api/notes/${note.id}`, {
          method: "PUT",
          body: JSON.stringify({
            track: to.track,
            timeTick: to.timeTick,
            version: note.version,
          }),
        });
        // Replace with server response (includes new version)
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      } catch (err) {
        // Revert on 409 (stale) or any other error
        setNotes((prev) =>
          prev.map((n) => (n.id === note.id ? note : n))
        );
        const msg =
          err instanceof ApiError && err.status === 409
            ? "Conflict: note moved by another user — reverted"
            : err instanceof Error
            ? err.message
            : "Move failed";
        flash(msg);
      }
    },
    [flash]
  );

  const deleteNote = useCallback(async (id: string) => {
    // Optimistic remove
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await apiFetch<void>(`/api/notes/${id}`, { method: "DELETE" });
    } catch (err) {
      // Refresh from server on failure (note may already be gone)
      const msg = err instanceof Error ? err.message : "Delete failed";
      setError(msg);
    }
  }, []);

  return { notes, loading, error, statusMessage, createNote, moveNote, deleteNote };
}
