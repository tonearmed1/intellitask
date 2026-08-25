import { defineConfig } from "vitest/config";
import path from "node:path";

const dirname = import.meta.dirname;

// Pure-logic unit tests: no D1, no Workers runtime — plain Node/vite-node.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      "@shared": path.resolve(dirname, "./shared"),
      "@worker": path.resolve(dirname, "./worker"),
    },
  },
  test: {
    name: "unit",
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
