import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { webcrypto as crypto, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { E2E_DATABASE_URL } from "./db";

export const E2E_USERNAME = "e2e_user";
export const E2E_PASSWORD = "e2e-test-password-123";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "../../migrations");

// Must stay in sync with worker/lib/auth.ts hashPassword/verifyPassword.
const PBKDF2_ITERATIONS = 100_000;
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  const toB64 = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(derived)}`;
}

/**
 * Prepares a fully-local Postgres-compatible database (PGlite, WASM, no
 * external service or account needed) and exposes it over a real Postgres
 * wire-protocol TCP socket at the fixed address in ./db.ts, so the API
 * dev-server (started separately by Playwright's webServer using the exact
 * same production `pg` client code) can connect to it normally.
 */
export default async function globalSetup() {
  const pglite = new PGlite();

  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrationFiles) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    await pglite.exec(sql);
  }

  const passwordHash = await hashPassword(E2E_PASSWORD);
  await pglite.query(
    `INSERT INTO users (id, username, password_hash, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash`,
    [`user_${randomUUID().replace(/-/g, "")}`, E2E_USERNAME, passwordHash, new Date().toISOString()],
  );

  const url = new URL(E2E_DATABASE_URL);
  const socketServer = new PGLiteSocketServer({
    db: pglite,
    host: url.hostname,
    port: Number(url.port),
    // The Node `pg` Pool used by worker/db/client.ts opens several
    // connections; PGLiteSocketServer defaults to accepting only 1, which
    // caused intermittent connection failures under real concurrency.
    // Queries are still serialized internally against the single PGlite
    // instance either way, so this only affects how many clients can be
    // *connected* at once, not write safety.
    maxConnections: 20,
  });
  await socketServer.start();

  return async () => {
    await socketServer.stop();
    await pglite.close();
  };
}
