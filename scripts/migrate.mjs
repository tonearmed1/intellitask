#!/usr/bin/env node
// Applies any not-yet-applied .sql files in /migrations, in filename order,
// tracking what's been applied in a `_migrations` table — mirroring how
// wrangler's D1 migration tracking worked, just hand-rolled for Postgres.
//
// Usage: DATABASE_URL=postgres://... node scripts/migrate.mjs

import "dotenv/config";
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(dirname, "../migrations");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const applied = new Set(
      (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      console.log(`apply ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("Migrations up to date.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
