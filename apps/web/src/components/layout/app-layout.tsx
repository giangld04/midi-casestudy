/**
 * Root layout shell.
 * Structure: Toolbar (top) → [SongList sidebar | main content] → StatusBar (bottom).
 */

import type { ReactNode } from "react";

interface AppLayoutProps {
  toolbar: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
  statusBar: ReactNode;
}

export default function AppLayout({
  toolbar,
  sidebar,
  main,
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
      </div>

      {statusBar}
    </div>
  );
}
