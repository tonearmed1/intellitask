// Local development API server. Runs the same Hono app used in production
// (api/[...path].ts wraps it for Vercel) directly under Node via
// @hono/node-server, so `npm run dev` doesn't need the Vercel CLI or a
// Vercel account — vite dev proxies /api requests here (see vite.config.ts).
import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "../worker/index";

const port = Number(process.env.API_PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API dev server listening on http://localhost:${info.port}`);
});
