import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createDb, type Database } from "../../worker/db/client";
import type { Env } from "../../worker/types/env";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "../../migrations");

export interface TestContext {
  db: Database;
  env: Env;
  dispose: () => Promise<void>;
}

/**
 * Spins up a real D1 (SQLite-backed) instance via Miniflare's Node API,
 * applies every migration in /migrations, and returns a ready-to-use
 * drizzle db plus a minimal Env for exercising worker services directly.
 */
export async function createTestContext(): Promise<TestContext> {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } };",
    d1Databases: { DB: "test-db" },
  });

  const d1 = await mf.getD1Database("DB");

  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrationFiles) {
    const raw = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const withoutComments = raw
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    const statements = withoutComments
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const statement of statements) {
      await d1.prepare(statement).run();
    }
  }

  const db = createDb(d1);
  const env: Env = {
    DB: d1,
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 }),
    } as unknown as Fetcher,
    AI_PROVIDER: "mock",
    AI_MODEL: "mock-v1",
    ALLOW_WEB_RESEARCH: "false",
  };

  return {
    db,
    env,
    dispose: () => mf.dispose(),
  };
}
