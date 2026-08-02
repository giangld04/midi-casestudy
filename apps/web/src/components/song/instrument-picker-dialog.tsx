/**
 * Two-pane General MIDI instrument picker (screenshot: Categories | Instruments).
 *
 * Left pane = the 16 GM families; selecting one filters the right pane to its 8
 * instruments. The choice is confirmed with OK (applies to the whole song) or
 * discarded with Cancel. Styling follows the app's dark theme + green accent.
 */

import { useMemo, useState } from "react";
import { GM_CATEGORIES } from "@/lib/gm-instruments";

interface InstrumentPickerDialogProps {
  /** Currently active instrument id (highlighted on open). */
  current: string;
  /** Confirm → apply the chosen instrument to the song. */
  onSelect: (instrument: string) => void;
  onCancel: () => void;
}

/** Index of the category that contains `instrument` (fallback: first). */
function categoryIndexOf(instrument: string): number {
  const idx = GM_CATEGORIES.findIndex((c) =>
    c.instruments.some((i) => i.value === instrument)
  );
  return idx === -1 ? 0 : idx;
}

export default function InstrumentPickerDialog({
  current,
  onSelect,
  onCancel,
}: InstrumentPickerDialogProps) {
  const [categoryIndex, setCategoryIndex] = useState(() => categoryIndexOf(current));
  const [selected, setSelected] = useState(current);

  const instruments = useMemo(
    () => GM_CATEGORIES[categoryIndex]?.instruments ?? [],
    [categoryIndex]
  );

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={titleStyle}>Choose Instrument</h2>

        <div style={panesStyle}>
          {/* Categories */}
          <ul style={categoryPaneStyle}>
            {GM_CATEGORIES.map((cat, i) => {
              const active = i === categoryIndex;
              return (
                <li key={cat.name}>
                  <button
                    type="button"
                    onClick={() => setCategoryIndex(i)}
                    style={{
                      ...listButtonStyle,
                      background: active ? "var(--bg-primary)" : "transparent",
                      color: active ? "var(--text-primary)" : "var(--text-muted)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {cat.name}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Instruments in the active category */}
          <ul style={instrumentPaneStyle}>
            {instruments.map((inst) => {
              const active = inst.value === selected;
              return (
                <li key={inst.value}>
                  <button
                    type="button"
                    onClick={() => setSelected(inst.value)}
                    onDoubleClick={() => onSelect(inst.value)}
                    style={{
                      ...listButtonStyle,
                      background: active ? "var(--accent-green-subtle)" : "transparent",
                      color: active ? "var(--accent-green)" : "var(--text-primary)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {inst.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div style={footerStyle}>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="accent" onClick={() => onSelect(selected)}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
};

const dialogStyle: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 20,
  width: 520,
  maxWidth: "90vw",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  margin: 0,
};

const panesStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  height: 300,
};

const paneBaseStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 4,
  overflowY: "auto",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg-primary)",
};

const categoryPaneStyle: React.CSSProperties = { ...paneBaseStyle };
const instrumentPaneStyle: React.CSSProperties = { ...paneBaseStyle };

const listButtonStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "6px 10px",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
};
