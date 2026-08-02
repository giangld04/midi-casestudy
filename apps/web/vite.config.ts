// Vite configuration for AMA-MIDI web app
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Allow @/ imports to resolve to src/
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Forward /api requests to the Express API server
      // Forward /api/* unchanged to Express server (API mounts at /api/*)
      // Target is env-configurable so e2e/CI can point at an API on an
      // alternate port when the default 3000 is occupied.
      "/api": {
        target: process.env["VITE_API_PROXY_TARGET"] || "http://localhost:3000",
        changeOrigin: true,
      },
      // WebSocket handshake for Socket.io — same-origin client connects here in
      // dev, matching the prod nginx /socket.io proxy. ws:true upgrades frames.
      "/socket.io": {
        target: process.env["VITE_API_PROXY_TARGET"] || "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
