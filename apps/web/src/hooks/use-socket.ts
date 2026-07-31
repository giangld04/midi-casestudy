/**
 * Manages the shared Socket.io connection + song-room membership, presence, and
 * live remote cursors. Returns the socket instance so useRealtimeNotes can bind
 * note-event listeners to the same connection.
 *
 * Lifecycle:
 *   - connect on mount, disconnect on unmount
 *   - join `song:{id}` when songId changes; auto-rejoin on reconnect
 *   - track presence list + remote cursors (pruned on leave/presence updates)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { PresenceUser, RemoteCursor } from "@ama-midi/shared";
import { getSocket, type AppSocket } from "@/lib/socket-client";

const CURSOR_THROTTLE_MS = 40; // ~25 fps cursor updates — smooth but light

export interface UseSocket {
  socket: AppSocket;
  connected: boolean;
  presence: PresenceUser[];
  cursors: RemoteCursor[];
  emitCursor: (track: number, timeTick: number) => void;
}

export function useSocket(songId: string | null, name?: string): UseSocket {
  const socketRef = useRef<AppSocket>(getSocket());
  const [connected, setConnected] = useState(socketRef.current.connected);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const lastCursorAt = useRef(0);

  // Connect once on mount; disconnect on unmount
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket.connected) socket.connect();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // Presence + cursor listeners (bound once)
  useEffect(() => {
    const socket = socketRef.current;
    const onPresence = ({ users }: { users: PresenceUser[] }) => {
      setPresence(users);
      // Drop cursors for users no longer present
      setCursors((prev) => {
        const ids = new Set(users.map((u) => u.id));
        const next = new Map<string, RemoteCursor>();
        for (const [id, cur] of prev) if (ids.has(id)) next.set(id, cur);
        return next;
      });
    };
    const onCursor = (c: RemoteCursor) =>
      setCursors((prev) => new Map(prev).set(c.userId, c));
    const onCursorLeave = ({ userId }: { userId: string }) =>
      setCursors((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });

    socket.on("presence:update", onPresence);
    socket.on("cursor:update", onCursor);
    socket.on("cursor:leave", onCursorLeave);
    return () => {
      socket.off("presence:update", onPresence);
      socket.off("cursor:update", onCursor);
      socket.off("cursor:leave", onCursorLeave);
    };
  }, []);

  // Join/leave the song room when songId changes; re-join on reconnect
  useEffect(() => {
    const socket = socketRef.current;
    if (!songId) return;

    const join = () => socket.emit("join-song", { songId, name });
    if (socket.connected) join();
    socket.on("connect", join); // auto-rejoin after a reconnect

    return () => {
      socket.off("connect", join);
      // Emit unconditionally: if mid-reconnect, socket.io buffers and flushes on
      // reconnect, avoiding a ~20s presence "ghost" until server pingTimeout.
      socket.emit("leave-song", { songId });
      setPresence([]);
      setCursors(new Map());
    };
  }, [songId, name]);

  const emitCursor = useCallback(
    (track: number, timeTick: number) => {
      const socket = socketRef.current;
      if (!songId || !socket.connected) return;
      const now = Date.now();
      if (now - lastCursorAt.current < CURSOR_THROTTLE_MS) return;
      lastCursorAt.current = now;
      socket.emit("cursor:move", { songId, track, timeTick });
    },
    [songId]
  );

  return {
    socket: socketRef.current,
    connected,
    presence,
    cursors: Array.from(cursors.values()),
    emitCursor,
  };
}
