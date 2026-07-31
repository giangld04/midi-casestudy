// Socket handlers for room membership, presence, and live cursors.
//   join-song  → socket joins `song:{id}`, presence list re-broadcast to room
//   leave-song → socket leaves room, presence updated
//   cursor:move→ relayed (volatile) to other room members as cursor:update
//   disconnect → cleanup + presence/cursor removal broadcast
//
// Cursors are ephemeral (never persisted) and sent volatile so a dropped packet
// under load is simply skipped rather than queued.

import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@ama-midi/shared";
import { addMember, removeMember, listMembers, getMember } from "./presence-store";
import { roomOf } from "./socket-utils";
import type { SocketData } from "./socket-server";

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/** Re-broadcast the current presence list for a room to everyone in it. */
function broadcastPresence(io: IO, songId: string): void {
  io.to(roomOf(songId)).emit("presence:update", { users: listMembers(songId) });
}

export function registerSongRoomHandlers(io: IO, socket: ClientSocket): void {
  socket.on("join-song", async ({ songId, name }) => {
    // One active room per socket: leave any previous room first
    const previous = removeMember(socket.id);
    if (previous && previous !== songId) {
      await socket.leave(roomOf(previous)); // async under the Redis adapter
      broadcastPresence(io, previous);
    }
    await socket.join(roomOf(songId));
    addMember(socket.id, songId, name);
    broadcastPresence(io, songId);
  });

  socket.on("leave-song", async ({ songId }) => {
    await socket.leave(roomOf(songId));
    const left = removeMember(socket.id);
    socket.to(roomOf(songId)).emit("cursor:leave", { userId: socket.id });
    if (left) broadcastPresence(io, songId);
  });

  socket.on("cursor:move", ({ songId, track, timeTick }) => {
    const member = getMember(socket.id);
    if (!member) return; // must have joined the room first
    // volatile: skip rather than buffer if the client can't keep up
    socket.volatile.to(roomOf(songId)).emit("cursor:update", {
      userId: member.id,
      name: member.name,
      color: member.color,
      track,
      timeTick,
    });
  });

  socket.on("disconnect", () => {
    const songId = removeMember(socket.id);
    if (songId) {
      socket.to(roomOf(songId)).emit("cursor:leave", { userId: socket.id });
      broadcastPresence(io, songId);
    }
  });
}
