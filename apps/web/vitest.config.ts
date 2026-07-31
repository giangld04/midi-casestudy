// Vitest configuration — node env is sufficient for pure-function tests
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
