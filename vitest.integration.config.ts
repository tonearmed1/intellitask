import { defineConfig } from "vitest/config";
import path from "node:path";

const dirname = import.meta.dirname;

// Integration tests run as plain Node tests, but exercise a real D1/SQLite
// engine via Miniflare's Node API (see tests/integration/setup.ts) — real
// database behavior (constraints, migrations) without the complexity of
// running the whole test file inside a sandboxed Workers isolate.
export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(dirname, "./shared"),
      "@worker": path.resolve(dirname, "./worker"),
    },
  },
  test: {
    name: "integration",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
