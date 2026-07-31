// In-memory presence registry: which users occupy which song rooms.
// Kept process-local on purpose — cross-instance fan-out is handled by the
// Socket.io Redis adapter at the broadcast layer, while this store only needs
// to answer "who is in this room on THIS node" for building presence lists.
//
// NOTE: presence lists are advisory UI state; the authoritative note data lives
// in Postgres. Losing a node's presence map on restart is harmless.

import { PRESENCE_COLORS, type PresenceUser } from "@ama-midi/shared";

interface Member extends PresenceUser {
  songId: string;
}

/** socketId → member record (one active song room per socket at a time). */
const members = new Map<string, Member>();

/** Deterministic-ish color pick so a user keeps a stable color within a session. */
function pickColor(socketId: string): string {
  let hash = 0;
  for (let i = 0; i < socketId.length; i++) {
    hash = (hash * 31 + socketId.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length] as string;
}

/** Register a socket as present in a song room. Returns the created member. */
export function addMember(socketId: string, songId: string, name?: string): PresenceUser {
  const member: Member = {
    id: socketId,
    songId,
    name: name?.trim() || `Guest-${socketId.slice(0, 4)}`,
    color: pickColor(socketId),
  };
  members.set(socketId, member);
  return toUser(member);
}

/** Remove a socket from presence entirely. Returns its last songId, if any. */
export function removeMember(socketId: string): string | null {
  const member = members.get(socketId);
  if (!member) return null;
  members.delete(socketId);
  return member.songId;
}

/** All users currently present in a given song room (on this node). */
export function listMembers(songId: string): PresenceUser[] {
  const out: PresenceUser[] = [];
  for (const member of members.values()) {
    if (member.songId === songId) out.push(toUser(member));
  }
  return out;
}

/** Look up a single member (used to enrich cursor broadcasts). */
export function getMember(socketId: string): PresenceUser | null {
  const member = members.get(socketId);
  return member ? toUser(member) : null;
}

/** The song room a socket currently occupies, or null if it hasn't joined. */
export function getMemberSongId(socketId: string): string | null {
  return members.get(socketId)?.songId ?? null;
}

function toUser(member: Member): PresenceUser {
  return { id: member.id, name: member.name, color: member.color };
}
