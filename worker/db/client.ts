import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

let pool: pg.Pool | null = null;

/**
 * Lazily creates (and reuses) a connection pool for the lifetime of the
 * server process — a warm Vercel Node.js function instance reuses this
 * across invocations, same as a normal long-lived server would.
 *
 * Plain `pg` rather than a Neon-specific driver: this runs on Vercel's
 * Node.js runtime (not Edge), which has full TCP socket support, so there's
 * no need for the HTTP/WebSocket workarounds Neon's serverless driver
 * exists for — and a standard Postgres connection works identically
 * against Neon, Vercel Postgres, or a local/test Postgres instance.
 */
export function createDb(connectionString: string): Database {
  if (!pool) {
    // Kept small: each serverless function instance holds its own pool, and
    // Postgres providers (Neon included) cap total concurrent connections.
    pool = new pg.Pool({ connectionString, max: 5 });
    // A pooled connection can be dropped by the server/network at any time
    // (idle timeout, process shutdown, etc). Without a listener here, `pg`
    // treats that as an unhandled 'error' event and crashes the process.
    pool.on("error", (err) => {
      console.error("Unexpected error on idle Postgres client:", err.message);
    });
  }
  return drizzle(pool, { schema });
}

export { schema };
