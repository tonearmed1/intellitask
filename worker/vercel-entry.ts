// Source for the Vercel serverless function that serves /api/*. This file
// is bundled by scripts/build-api.mjs into api/index.ts at build time —
// it is NOT deployed as-is.
//
// Why bundle instead of letting Vercel compile api/[...path].ts directly:
// with "type": "module" in package.json, Vercel's Node builder does not
// bundle TypeScript API routes — it transpiles each file individually and
// runs the result under Node's native ESM loader, which requires every
// relative import to carry an explicit .js extension and cannot resolve
// our @shared/* tsconfig path alias at all. Our source is written for
// bundler-style resolution (Vite/Vitest/esbuild), matching the rest of the
// codebase, so we pre-bundle the function ourselves with esbuild instead of
// rewriting ~200 import specifiers to satisfy Node's raw ESM resolver.
//
// Deliberately on the Node.js runtime (the default — no `export const
// runtime = "edge"`), since this needs a real TCP connection to Postgres,
// which isn't available on Vercel's Edge runtime.
import { handle } from "hono/vercel";
import app from "./index";

// Vercel's Node.js runtime only recognizes the Web-standard fetch signature
// (Request -> Response) via named HTTP-method exports (or a `fetch` export)
// — a bare `export default` is silently treated as the legacy (req, res)
// Node handler shape and the returned Response is dropped, hanging the
// request until timeout. Hono's routing is method-aware internally, so the
// same handler is exported under every method Vercel dispatches.
const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
