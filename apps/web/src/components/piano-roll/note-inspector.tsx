/**
 * Right-side Inspector: edit the selected note's details as ONE submit form
 * (Title, Description, Track 1-8, Time tick, Color) + Save / Cancel.
 *
 * Why submit (not inline): a note detail is a coherent multi-field record, so we
 * draft locally and commit atomically. Save sends only the changed fields in a
 * single optimistic-locked update, keyed to the version captured when the form
 * loaded — a concurrent remote edit is caught (409 → reconcile) rather than
 * silently overwritten. Remote changes while editing raise a visible warning.
 */

import { useEffect, useRef, useState } from "react";
import type { Note } from "@ama-midi/shared";
import { TRACK_COUNT, MAX_TIME_TICK } from "@ama-midi/shared";
import type { NoteEdits } from "@/hooks/use-notes";

interface NoteInspectorProps {
  note: Note | null;
  onUpdate: (note: Note, changes: NoteEdits) => void;
  onDelete: (id: string) => void;
}

interface Draft {
  title: string;
  description: string;
  track: number;
  timeTick: number;
  color: string;
}

const draftOf = (n: Note): Draft => ({
  title: n.title,
  description: n.description ?? "",
  track: n.track,
  timeTick: n.timeTick,
  color: n.color,
});

/** Diff a draft against its base note → only the fields that actually changed. */
function changedFields(draft: Draft, base: Note): NoteEdits {
  const c: NoteEdits = {};
  const title = draft.title.trim();
  if (title && title !== base.title) c.title = title;
  if (draft.description !== (base.description ?? "")) c.description = draft.description;
  if (draft.track !== base.track) c.track = draft.track as Note["track"];
  if (draft.timeTick !== base.timeTick) c.timeTick = draft.timeTick;
  if (draft.color !== base.color) c.color = draft.color;
  return c;
}

export default function NoteInspector({ note, onUpdate, onDelete }: NoteInspectorProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  // Snapshot (incl. version) the draft is based on — the commit target.
  const baseRef = useRef<Note | null>(null);
  const [remoteChanged, setRemoteChanged] = useState(false);

  const dirty =
    !!draft && !!baseRef.current && Object.keys(changedFields(draft, baseRef.current)).length > 0;

  // Load / reconcile the form when the selected note (id) or its version changes.
  useEffect(() => {
    if (!note) {
      baseRef.current = null;
      setDraft(null);
      setRemoteChanged(false);
      return;
    }
    const base = baseRef.current;
    const hasEdits = base && draft ? Object.keys(changedFields(draft, base)).length > 0 : false;
    if (base?.id !== note.id || !hasEdits) {
      // New note, or no unsaved edits → adopt server state as the new base.
      baseRef.current = note;
      setDraft(draftOf(note));
      setRemoteChanged(false);
    } else {
      // Same note changed underneath while editing → keep draft, warn the user.
      setRemoteChanged(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, note?.version]);

  if (!note || !draft) {
    return (
      <aside style={panelStyle}>
        <div style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6 }}>
          Select a note to edit its details.
          <br />
          Click a note on the grid.
        </div>
      </aside>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const onSave = () => {
    if (!baseRef.current) return;
    const changes = changedFields(draft, baseRef.current);
    if (Object.keys(changes).length) onUpdate(baseRef.current, changes);
  };
  const onCancel = () => {
    baseRef.current = note;
    setDraft(draftOf(note));
    setRemoteChanged(false);
  };

  const seconds = (draft.timeTick / 4).toFixed(2);

  return (
    <aside style={panelStyle}>
      <div style={headingStyle}>Note Inspector</div>

      {remoteChanged && (
        <div style={warnStyle}>
          ⚠ This note changed elsewhere. Saving may conflict — Cancel to load the latest.
        </div>
      )}

      <label style={labelStyle}>
        Title
        <input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={255}
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Description
        <textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Optional notes…"
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </label>

      <label style={labelStyle}>
        Track (1-{TRACK_COUNT})
        <select
          value={draft.track}
          onChange={(e) => set("track", Number(e.target.value))}
          style={inputStyle}
        >
          {Array.from({ length: TRACK_COUNT }, (_, i) => i + 1).map((t) => (
            <option key={t} value={t}>
              Track {t}
            </option>
          ))}
        </select>
      </label>

      <label style={labelStyle}>
        Time (tick 0-{MAX_TIME_TICK}) · {seconds}s
        <input
          type="number"
          min={0}
          max={MAX_TIME_TICK}
          value={draft.timeTick}
          onChange={(e) =>
            set("timeTick", Math.max(0, Math.min(MAX_TIME_TICK, Number(e.target.value))))
          }
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Color
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="color"
            value={draft.color}
            onChange={(e) => set("color", e.target.value)}
            style={{ width: 40, height: 30, padding: 0, border: "1px solid var(--border)", borderRadius: 4, background: "none" }}
          />
          <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)" }}>
            {draft.color}
          </span>
        </div>
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onSave} disabled={!dirty} style={saveButtonStyle(dirty)}>
          Save
        </button>
        <button type="button" onClick={onCancel} disabled={!dirty && !remoteChanged} style={cancelButtonStyle}>
          Cancel
        </button>
      </div>

      <button type="button" onClick={() => onDelete(note.id)} style={deleteButtonStyle}>
        ⌫ Delete note
      </button>
    </aside>
  );
}

const panelStyle: React.CSSProperties = {
  width: 240,
  flexShrink: 0,
  height: "100%",
  overflowY: "auto",
  padding: "12px 14px",
  background: "var(--bg-secondary)",
  borderLeft: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const headingStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "var(--text-muted)",
};

const warnStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.5,
  color: "#0b0b0f",
  background: "#ffd93d",
  borderRadius: 4,
  padding: "6px 8px",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11,
  color: "var(--text-muted)",
};

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 13,
  color: "var(--text)",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  outline: "none",
};

const saveButtonStyle = (enabled: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 700,
  color: "#0b0b0f",
  background: enabled ? "var(--accent, #22d3ee)" : "var(--border)",
  border: "none",
  borderRadius: 4,
  cursor: enabled ? "pointer" : "not-allowed",
});

const cancelButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text)",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 4,
  cursor: "pointer",
};

const deleteButtonStyle: React.CSSProperties = {
  marginTop: "auto",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 600,
  color: "#ff6b6b",
  background: "transparent",
  border: "1px solid #ff6b6b",
  borderRadius: 4,
  cursor: "pointer",
};
