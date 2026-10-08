import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // Component tests are .tsx. An esbuild jsx option is not enough here:
  // tsconfig.json sets `jsx: "preserve"` (Next.js compiles JSX itself), vite
  // honours that, and the file reaches import-analysis as raw JSX.
  plugins: [react()],
  test: {
    environment: "node",
    // Node 25+ exposes its own storage globals. Keep jsdom's per-origin
    // Storage in browser suites instead of the host's file-backed storage.
    execArgv: process.allowedNodeEnvironmentFlags.has("--no-experimental-webstorage")
      ? ["--no-experimental-webstorage"]
      : [],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // DB fixtures use separate schemas but share PostgreSQL catalogs. A
    // different suite's DROP can race migration constraint introspection.
    // Serialize files; explicit concurrent clients inside the security and
    // admission tests still exercise the real locking/race boundaries.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
