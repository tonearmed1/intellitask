import type { MiddlewareHandler } from "hono";
import { getSessionCookieValue, getValidSession, pruneExpiredSessions } from "../lib/auth";
import { Errors } from "../lib/errors";
import { isAuthDisabled } from "../types/env";
import type { AppEnv } from "../types/hono";

/** Placeholder user id used when AUTH_DISABLED=true (no session exists). */
export const OWNER_USER_ID = "owner";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (isAuthDisabled(c.get("appEnv"))) {
    c.set("userId", OWNER_USER_ID);
    await next();
    return;
  }

  const cookieHeader = c.req.header("cookie") ?? null;
  const sessionId = getSessionCookieValue(cookieHeader);
  if (!sessionId) throw Errors.unauthorized();

  const db = c.get("db");
  const session = await getValidSession(db, sessionId);
  if (!session) throw Errors.unauthorized("Your session has expired. Please sign in again.");

  c.set("userId", session.userId);

  // Cheap housekeeping so expired sessions don't accumulate. Awaited
  // directly (no background-task API to rely on here) but only runs on a
  // small fraction of requests, and it's a single indexed DELETE.
  if (Math.random() < 0.02) {
    await pruneExpiredSessions(db).catch(() => undefined);
  }

  await next();
};
