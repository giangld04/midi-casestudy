/**
 * Root layout shell.
 * Structure: Toolbar (top) → [SongList sidebar | main content] → StatusBar (bottom).
 */

import type { ReactNode } from "react";

interface AppLayoutProps {
  toolbar: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
  /** Optional right-side panel (Note Inspector) */
  inspector?: ReactNode;
  statusBar: ReactNode;
}

export default function AppLayout({
  toolbar,
  sidebar,
  main,
  inspector,
  statusBar,
}: AppLayoutProps) {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg-primary)",
      }}
    >
      {toolbar}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {sidebar}
        <main style={{ flex: 1, overflow: "hidden" }}>{main}</main>
        {inspector}
      </div>

      {statusBar}
    </div>
  );
}
