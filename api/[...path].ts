// Vercel serverless function entrypoint. The filename's catch-all segment
// (`[...path]`) makes Vercel route every request under /api/* here; the
// Hono app in worker/index.ts does its own sub-routing from there.
//
// Deliberately on the Node.js runtime (the default — no `export const
// runtime = "edge"`), since the Postgres driver uses the `ws` package for
// its WebSocket connection, which isn't available on Vercel's Edge runtime.
import { handle } from "hono/vercel";
import app from "../worker/index";

export default handle(app);
