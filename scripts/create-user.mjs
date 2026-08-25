#!/usr/bin/env node
// Creates (or prints SQL to create) the single Intellitask user account.
//
// Usage:
//   node scripts/create-user.mjs <username> <password>
//   node scripts/create-user.mjs <username> <password> --apply --local
//   node scripts/create-user.mjs <username> <password> --apply --remote
//
// The password hashing here (PBKDF2-SHA256, 100000 iterations) must stay in
// sync with worker/lib/auth.ts `hashPassword`/`verifyPassword`.

import { webcrypto as crypto } from "node:crypto";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

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
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const [username, password] = positional;

  if (!username || !password) {
    console.error("Usage: node scripts/create-user.mjs <username> <password> [--apply --local|--remote]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const id = `user_${randomUUID().replace(/-/g, "")}`;
  const createdAt = new Date().toISOString();

  const escapedUsername = username.replace(/'/g, "''");
  const sql = `INSERT INTO users (id, username, password_hash, created_at) VALUES ('${id}', '${escapedUsername}', '${passwordHash}', '${createdAt}') ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash;`;

  if (flags.has("--apply")) {
    const target = flags.has("--remote") ? "--remote" : "--local";
    console.log(`Applying to D1 (${target})...`);
    execFileSync(
      "npx",
      ["wrangler", "d1", "execute", "intellitask-db", target, "--command", sql],
      { stdio: "inherit" },
    );
    console.log(`\nUser "${username}" created/updated.`);
  } else {
    console.log("\nRun this against your D1 database (or re-run with --apply --local / --apply --remote):\n");
    console.log(sql);
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
