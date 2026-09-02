#!/usr/bin/env node
// Bundles worker/vercel-entry.ts (the Hono app + hono/vercel adapter) into
// a single self-contained api/index.ts. See worker/vercel-entry.ts for why
// this is necessary instead of letting Vercel compile the TS directly.
//
// npm packages are left external (resolved from node_modules at runtime by
// Node itself, which Vercel includes based on package.json) — only our own
// relative-import graph (worker/**, shared/**) gets inlined, which is the
// part Node's native ESM loader can't resolve on its own.
//
// A plain, non-dynamic filename (api/index.ts, not api/[...path].ts): in
// testing, Vercel's zero-config router generated a single-segment-only
// regex (`/api/([^/]+)`) for a `[...path]` catch-all function regardless of
// its extension, 404ing any nested path like /api/auth/login. vercel.json
// instead rewrites `/api/:path*` to this plain function explicitly, which
// routes correctly — the rewrite doesn't change the Request's actual URL,
// so Hono's own pathname-based routing inside the app still sees the real
// incoming path.
import { build } from "esbuild";
import { mkdirSync } from "node:fs";

const outfile = "api/index.ts";

mkdirSync("api", { recursive: true });

await build({
  entryPoints: ["worker/vercel-entry.ts"],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  // The root tsconfig.json is a bare project-references aggregator with no
  // "paths" — without pointing esbuild at tsconfig.worker.json explicitly,
  // it can't resolve the @shared/* alias used throughout worker/**.
  tsconfig: "tsconfig.worker.json",
  logLevel: "info",
});

console.log(`Bundled API function -> ${outfile}`);
