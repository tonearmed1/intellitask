import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "../../worker/db/schema";
import type { Database } from "../../worker/db/client";
import type { Env } from "../../worker/types/env";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "../../migrations");

export interface TestContext {
  db: Database;
  env: Env;
  dispose: () => Promise<void>;
}

/**
 * Spins up a real, fully-local Postgres-compatible engine (PGlite, WASM, no
 * external service or Docker needed), applies every migration in
 * /migrations, and returns a ready-to-use drizzle db plus a minimal Env for
 * exercising worker services directly — mirroring exactly what runs in
 * production (same schema, same SQL dialect, real transactions).
 */
export async function createTestContext(): Promise<TestContext> {
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema }) as unknown as Database;

  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrationFiles) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    await pglite.exec(sql);
  }

  const env: Env = {
    AI_PROVIDER: "mock",
    AI_MODEL: "mock-v1",
    ALLOW_WEB_RESEARCH: "false",
  };

  return {
    db,
    env,
    dispose: async () => {
      await pglite.close();
    },
  };
}
