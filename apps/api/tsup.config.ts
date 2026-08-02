import { defineConfig } from "tsup";

// Production bundle for the API.
//
// Why bundling: the workspace packages `@ama-midi/db` and `@ama-midi/shared`
// ship raw TypeScript (their package.json `main` points at `src/index.ts`).
// A plain `tsc` build leaves `require("@ama-midi/db")` in the output, which
// crashes under `node dist/index.js` because Node cannot load `.ts` files.
//
// tsup (esbuild) inlines ONLY those workspace packages via `noExternal`, while
// every real npm dependency stays external and is resolved from the pruned
// production `node_modules` produced by `pnpm --prod deploy`.
export default defineConfig({
  // Second entry builds the telemetry bootstrap as its own file so prod can preload
  // it via `node --require ./dist/observability/telemetry.js` BEFORE index.js loads,
  // guaranteeing OpenTelemetry patches http/express/pg/ioredis in time.
  entry: ["src/index.ts", "src/observability/telemetry.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node24",
  outDir: "dist",
  bundle: true,
  splitting: false,
  clean: true,
  sourcemap: false,
  // Force the internal workspace packages into the bundle; leave npm deps external.
  noExternal: ["@ama-midi/db", "@ama-midi/shared"],
});
