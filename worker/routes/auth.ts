import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "../db/schema";
import {
  buildCsrfCookie,
  buildSessionCookie,
  clearAuthCookies,
  createSession,
  deleteSession,
  generateCsrfToken,
  getSessionCookieValue,
  getValidSession,
  verifyPassword,
} from "../lib/auth";
import { Errors } from "../lib/errors";
import { parseJsonBody } from "../lib/validation";
import type { AppEnv } from "../types/hono";

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const authRoutes = new Hono<AppEnv>();

function isSecureRequest(url: string): boolean {
  return new URL(url).protocol === "https:";
}

authRoutes.post("/login", async (c) => {
  const body = await parseJsonBody(c.req.raw, loginSchema);
  const db = c.get("db");

  const rows = await db.select().from(users).where(eq(users.username, body.username)).limit(1);
  const user = rows[0];

  // Always run a hash comparison even when the user doesn't exist, so
  // response timing doesn't reveal whether the username is valid.
  const validPassword = user
    ? await verifyPassword(body.password, user.passwordHash)
    : await verifyPassword(body.password, DUMMY_HASH);

  if (!user || !validPassword) {
    throw Errors.unauthorized("Invalid username or password.");
  }

  const session = await createSession(db, user.id);
  const csrfToken = generateCsrfToken();
  const secure = isSecureRequest(c.req.url);

  c.header("Set-Cookie", buildSessionCookie(session.id, session.expiresAt, secure), {
    append: true,
  });
  c.header("Set-Cookie", buildCsrfCookie(csrfToken, session.expiresAt, secure), {
    append: true,
  });

  return c.json({ username: user.username, csrfToken });
});

authRoutes.post("/logout", async (c) => {
  const db = c.get("db");
  const sessionId = getSessionCookieValue(c.req.header("cookie") ?? null);
  if (sessionId) await deleteSession(db, sessionId);

  const secure = isSecureRequest(c.req.url);
  for (const cookie of clearAuthCookies(secure)) {
    c.header("Set-Cookie", cookie, { append: true });
  }
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const db = c.get("db");
  const sessionId = getSessionCookieValue(c.req.header("cookie") ?? null);
  if (!sessionId) throw Errors.unauthorized();

  const session = await getValidSession(db, sessionId);
  if (!session) throw Errors.unauthorized();

  const rows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const user = rows[0];
  if (!user) throw Errors.unauthorized();

  return c.json({ username: user.username });
});

// A syntactically valid PBKDF2 hash that no real password will match,
// used only to equalize timing when the username doesn't exist.
const DUMMY_HASH =
  "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
