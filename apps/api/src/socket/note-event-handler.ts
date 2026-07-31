// Socket handlers for real-time note mutations. These reuse the SAME service
// layer as the REST API (note-service), so all data-integrity guarantees —
// atomic upsert (duplicate cell → 409), optimistic locking, atomic event
// ledger — apply identically regardless of transport.
//
// Flow: sender optimistically renders locally, emits note:{create,update,delete}.
//   success → broadcast note:{created,updated,deleted} to the WHOLE room
//             (sender reconciles its temp/optimistic state on echo)
//   failure → note:rejected emitted to the SENDER only (rollback + toast)

import { z } from "zod";
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RejectCode,
} from "@ama-midi/shared";
import type { SocketData } from "./socket-server";
import { createNoteSchema, updateNoteSchema } from "../validators/note-validator";
import { createNote, updateNote, deleteNote } from "../services/note-service";
import { AppError } from "../lib/errors";
import { toNoteDto } from "../lib/to-note-dto";
import { RateLimiter } from "./rate-limiter";
import { roomOf } from "./socket-utils";
import { getMemberSongId } from "./presence-store";

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// Max 60 note mutations per minute per socket (Phase 05 security requirement).
const limiter = new RateLimiter(60, 60_000);

/** Map a thrown error to a client-facing reject code. */
function rejectCodeOf(err: unknown): RejectCode {
  if (err instanceof AppError) {
    if (err.code === "CONFLICT") return "CONFLICT";
    if (err.code === "NOT_FOUND") return "NOT_FOUND";
  }
  if (err instanceof z.ZodError) return "VALIDATION";
  return "SERVER_ERROR";
}

function messageOf(err: unknown): string {
  if (err instanceof z.ZodError) return err.issues[0]?.message ?? "Invalid payload";
  return err instanceof Error ? err.message : "Rejected";
}

export function registerNoteEventHandlers(io: IO, socket: ClientSocket): void {
  const reject = (reqId: string, code: RejectCode, error: string) =>
    socket.emit("note:rejected", { reqId, code, error });

  /**
   * Gate every mutation: the sender MUST have joined the target song room
   * (prevents editing arbitrary songs by UUID) and stay under the rate limit.
   */
  const precheck = (songId: string, reqId: string): boolean => {
    if (getMemberSongId(socket.id) !== songId) {
      reject(reqId, "FORBIDDEN", "Join the song before editing");
      return false;
    }
    if (!limiter.take(socket.id)) {
      reject(reqId, "RATE_LIMIT", "Too many edits — slow down");
      return false;
    }
    return true;
  };

  /** Uniform error handling: log genuine server faults, echo a reject to sender. */
  const fail = (reqId: string, err: unknown) => {
    const code = rejectCodeOf(err);
    if (code === "SERVER_ERROR") console.error("[socket] note mutation failed:", err);
    reject(reqId, code, messageOf(err));
  };

  socket.on("note:create", async (payload) => {
    if (!precheck(payload.songId, payload.reqId)) return;
    try {
      // Reuse REST validator: title/track/timeTick/color bounds enforced here too
      const input = createNoteSchema.parse({
        title: payload.title,
        track: payload.track,
        timeTick: payload.timeTick,
        color: payload.color,
      });
      const note = await createNote(payload.songId, input, socket.data.userId ?? null);
      io.to(roomOf(payload.songId)).emit("note:created", {
        note: toNoteDto(note),
        reqId: payload.reqId,
      });
    } catch (err) {
      fail(payload.reqId, err);
    }
  });

  socket.on("note:update", async (payload) => {
    if (!precheck(payload.songId, payload.reqId)) return;
    try {
      const input = updateNoteSchema.parse({
        title: payload.title,
        track: payload.track,
        timeTick: payload.timeTick,
        color: payload.color,
        version: payload.version,
      });
      const note = await updateNote(payload.noteId, input, socket.data.userId ?? null);
      io.to(roomOf(payload.songId)).emit("note:updated", {
        note: toNoteDto(note),
        reqId: payload.reqId,
      });
    } catch (err) {
      fail(payload.reqId, err);
    }
  });

  socket.on("note:delete", async (payload) => {
    if (!precheck(payload.songId, payload.reqId)) return;
    try {
      await deleteNote(payload.noteId, socket.data.userId ?? null);
      io.to(roomOf(payload.songId)).emit("note:deleted", {
        noteId: payload.noteId,
        reqId: payload.reqId,
      });
    } catch (err) {
      fail(payload.reqId, err);
    }
  });

  socket.on("disconnect", () => limiter.clear(socket.id));
}
