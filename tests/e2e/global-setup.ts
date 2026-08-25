import { execFileSync } from "node:child_process";
import path from "node:path";

export const E2E_USERNAME = "e2e_user";
export const E2E_PASSWORD = "e2e-test-password-123";

const ROOT = path.join(import.meta.dirname, "../..");

/**
 * Ensures the local D1 database has all migrations applied and a fixed test
 * user account exists, before any E2E test/browser is started. Both
 * operations are idempotent so this is safe to rerun.
 */
export default async function globalSetup() {
  execFileSync(
    "npx",
    ["wrangler", "d1", "migrations", "apply", "intellitask-db", "--local"],
    { cwd: ROOT, stdio: "inherit" },
  );

  execFileSync(
    "node",
    ["scripts/create-user.mjs", E2E_USERNAME, E2E_PASSWORD, "--apply", "--local"],
    { cwd: ROOT, stdio: "inherit" },
  );
}
