// Shared helpers for the socket layer.

/** Socket.io room name for a song's collaboration session. */
export const roomOf = (songId: string): string => `song:${songId}`;
