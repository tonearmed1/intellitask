// Shared by playwright.config.ts and global-setup.ts so the API dev-server
// (spawned by Playwright's webServer) and the PGlite instance (started in
// globalSetup) agree on a fixed local address — no dynamic env handoff
// between the two needed.
export const E2E_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:55432/e2e";
export const E2E_API_PORT = 8787;
