#!/usr/bin/env node
// Creates (or updates) the single Intellitask user account directly against
// the Postgres database pointed to by DATABASE_URL.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/create-user.mjs <username> <password>
//
// The password hashing here (PBKDF2-SHA256, 100000 iterations) must stay in
// sync with worker/lib/auth.ts `hashPassword`/`verifyPassword`.

import "dotenv/config";
import { webcrypto as crypto, randomUUID } from "node:crypto";
import pg from "pg";

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_LENGTH_BITS = 256;

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
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
    KEY_LENGTH_BITS,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
}

async function main() {
  const [username, password] = process.argv.slice(2);

  if (!username || !password) {
    console.error("Usage: DATABASE_URL=... node scripts/create-user.mjs <username> <password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const id = `user_${randomUUID().replace(/-/g, "")}`;
  const createdAt = new Date().toISOString();

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO users (id, username, password_hash, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash`,
      [id, username, passwordHash, createdAt],
    );
    console.log(`User "${username}" created/updated.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
