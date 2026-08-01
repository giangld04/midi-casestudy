/**
 * Root application component.
 * Phase 07: wrapped in ProtectedRoute (redirects to login if unauthenticated).
 * UserMenu added to Toolbar for logged-in users.
 */

import { useState } from "react";
import type { Note } from "@ama-midi/shared";
import { useSongs } from "@/hooks/use-songs";
import { useSocket } from "@/hooks/use-socket";
import { useRealtimeNotes } from "@/hooks/use-realtime-notes";
import { useAuth } from "@/hooks/use-auth";
import AppLayout from "@/components/layout/app-layout";
import Toolbar from "@/components/layout/toolbar";
import StatusBar from "@/components/layout/status-bar";
import ProtectedRoute from "@/components/layout/protected-route";
import SongList from "@/components/song/song-list";
import PianoRollStage from "@/components/piano-roll/piano-roll-stage";
import NoteInspector from "@/components/piano-roll/note-inspector";
import UserMenu from "@/components/auth/user-menu";

function MainApp() {
  const auth = useAuth();
  const songs = useSongs();
  const collab = useSocket(songs.selectedSongId);
  const notes = useRealtimeNotes(songs.selectedSongId, collab.socket);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const activeSong =
    songs.songs.find((s) => s.id === songs.selectedSongId) ?? null;

  // Resolve the selected note against the live notes array so the Inspector &
  // status bar always see the latest fields + version (avoids a stale snapshot).
  const liveSelectedNote =
    notes.notes.find((n) => n.id === selectedNote?.id) ?? null;

  return (
    <AppLayout
      toolbar={
        <Toolbar
          song={activeSong}
          noteCount={notes.notes.length}
          connected={collab.connected}
          presence={collab.presence}
          userMenu={auth.user ? <UserMenu user={auth.user} onLogout={auth.logout} /> : undefined}
          onSelectSong={songs.selectSong}
        />
      }
      sidebar={
        <SongList
          songs={songs.songs}
          selectedSongId={songs.selectedSongId}
          loading={songs.loading}
          error={songs.error}
          currentUserId={auth.user?.id ?? null}
          onSelect={songs.selectSong}
          onCreate={songs.createSong}
          onDelete={songs.deleteSong}
        />
      }
      main={
        songs.selectedSongId ? (
          <PianoRollStage
            notes={notes.notes}
            onCreateNote={notes.createNote}
            onMoveNote={notes.moveNote}
            onDeleteNote={(id) => {
              if (selectedNote?.id === id) setSelectedNote(null);
              return notes.deleteNote(id);
            }}
            cursors={collab.cursors}
            onCursorMove={collab.emitCursor}
            onSelectionChange={setSelectedNote}
          />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            Select or create a song to start editing
          </div>
        )
      }
      inspector={
        songs.selectedSongId ? (
          <NoteInspector
            note={liveSelectedNote}
            onUpdate={notes.updateNote}
            onDelete={(id) => {
              if (selectedNote?.id === id) setSelectedNote(null);
              return notes.deleteNote(id);
            }}
          />
        ) : undefined
      }
      statusBar={
        <StatusBar
          selectedNote={liveSelectedNote}
          statusMessage={notes.statusMessage}
          noteCount={notes.notes.length}
        />
      }
    />
  );
}

export default function App() {
  return (
    <ProtectedRoute>
      <MainApp />
    </ProtectedRoute>
  );
}
