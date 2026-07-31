/**
 * Real-time note state for a song. Drop-in replacement for useNotes: same shape
 * (notes/loading/error/createNote/moveNote/deleteNote) but mutations flow over
 * Socket.io instead of REST, with optimistic UI + rollback on server rejection.
 *
 * Reconciliation model:
 *   - Initial notes load via REST (source of truth on join).
 *   - Local mutation applies immediately (optimistic) + emits a socket event
 *     tagged with a unique reqId.
 *   - Server broadcasts note:{created,updated,deleted} to the whole room; every
 *     client (incl. sender) converges on the authoritative row by id.
 *   - Server emits note:rejected to the SENDER only → we roll back via the
 *     pending-op ledger keyed by reqId and flash a message.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Note } from "@ama-midi/shared";
import type { AppSocket } from "@/lib/socket-client";
import { apiFetch } from "@/lib/api-client";
import { trackColor } from "@/lib/colors";
import type { UseNotes, MovePayload } from "./use-notes";

/** A mutation awaiting server confirmation; `rollback` restores prior state. */
interface PendingOp {
  rollback: () => void;
}

const newReqId = (): string => crypto.randomUUID();

export function useRealtimeNotes(songId: string | null, socket: AppSocket): UseNotes {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pending = useRef<Map<string, PendingOp>>(new Map());

  const flash = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 2500);
  }, []);

  const upsert = useCallback((note: Note) => {
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === note.id);
      if (idx === -1) return [...prev, note];
      const next = [...prev];
      next[idx] = note;
      return next;
    });
  }, []);

  // Initial load whenever the song changes
  useEffect(() => {
    pending.current.clear();
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

  // Bind server → client note stream
  useEffect(() => {
    const onCreated = ({ note, reqId }: { note: Note; reqId: string }) => {
      const op = pending.current.get(reqId);
      if (op) {
        // Our own create confirmed: swap the temp note for the real row
        pending.current.delete(reqId);
        setNotes((prev) => [
          ...prev.filter((n) => n.id !== `temp-${reqId}`),
          note,
        ]);
      } else {
        upsert(note); // another client's create
      }
    };
    const onUpdated = ({ note, reqId }: { note: Note; reqId: string }) => {
      pending.current.delete(reqId); // confirmed — no rollback needed
      upsert(note);
    };
    const onDeleted = ({ noteId, reqId }: { noteId: string; reqId: string }) => {
      pending.current.delete(reqId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    };
    const onRejected = ({ reqId, error: msg }: { reqId: string; error: string }) => {
      const op = pending.current.get(reqId);
      if (op) {
        op.rollback();
        pending.current.delete(reqId);
      }
      flash(msg || "Change rejected — reverted");
    };

    socket.on("note:created", onCreated);
    socket.on("note:updated", onUpdated);
    socket.on("note:deleted", onDeleted);
    socket.on("note:rejected", onRejected);
    return () => {
      socket.off("note:created", onCreated);
      socket.off("note:updated", onUpdated);
      socket.off("note:deleted", onDeleted);
      socket.off("note:rejected", onRejected);
    };
  }, [socket, upsert, flash]);

  const createNote = useCallback(
    async (track: number, timeTick: number) => {
      if (!songId) return;
      const reqId = newReqId();
      const tempId = `temp-${reqId}`;
      const now = new Date();
      const optimistic: Note = {
        id: tempId,
        songId,
        title: "Note",
        track: track as Note["track"],
        timeTick,
        color: trackColor(track),
        version: 0,
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [...prev, optimistic]);
      pending.current.set(reqId, {
        rollback: () => setNotes((prev) => prev.filter((n) => n.id !== tempId)),
      });
      socket.emit("note:create", {
        songId,
        reqId,
        title: optimistic.title,
        track,
        timeTick,
        color: optimistic.color,
      });
    },
    [songId, socket]
  );

  const moveNote = useCallback(
    async (note: Note, to: MovePayload) => {
      if (!songId) return;
      const reqId = `move-${newReqId()}`;
      setNotes((prev) =>
        prev.map((n) =>
          n.id === note.id
            ? { ...n, track: to.track as Note["track"], timeTick: to.timeTick }
            : n
        )
      );
      pending.current.set(reqId, {
        rollback: () =>
          setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n))),
      });
      socket.emit("note:update", {
        songId,
        reqId,
        noteId: note.id,
        track: to.track,
        timeTick: to.timeTick,
        version: note.version,
      });
    },
    [songId, socket]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      if (!songId) return;
      const reqId = newReqId();
      // Capture the removed row inside the updater so we never read stale state
      let removed: Note | null = null;
      setNotes((prev) => {
        removed = prev.find((n) => n.id === id) ?? null;
        return prev.filter((n) => n.id !== id);
      });
      pending.current.set(reqId, {
        rollback: () => {
          if (removed) setNotes((prev) => [...prev, removed as Note]);
        },
      });
      socket.emit("note:delete", { songId, reqId, noteId: id });
    },
    [songId, socket]
  );

  return { notes, loading, error, statusMessage, createNote, moveNote, deleteNote };
}
