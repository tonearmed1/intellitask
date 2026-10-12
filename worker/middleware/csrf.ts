import type { MiddlewareHandler } from "hono";
import { isCsrfValid } from "../lib/csrf";
import { Errors } from "../lib/errors";
import { isAuthDisabled } from "../types/env";
import type { AppEnv } from "../types/hono";

export const requireCsrf: MiddlewareHandler<AppEnv> = async (c, next) => {
  // CSRF protects an authenticated session cookie; with auth disabled there
  // is no session to ride on, so there is nothing for it to protect.
  if (isAuthDisabled(c.get("appEnv"))) {
    await next();
    return;
  }
  const cookieHeader = c.req.header("cookie") ?? null;
  const csrfHeader = c.req.header("x-csrf-token") ?? null;
  if (!isCsrfValid(c.req.method, cookieHeader, csrfHeader)) {
    throw Errors.forbidden("Missing or invalid CSRF token.");
  }
  await next();
};
