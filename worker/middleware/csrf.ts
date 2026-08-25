import type { MiddlewareHandler } from "hono";
import { isCsrfValid } from "../lib/csrf";
import { Errors } from "../lib/errors";
import type { AppEnv } from "../types/hono";

export const requireCsrf: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cookieHeader = c.req.header("cookie") ?? null;
  const csrfHeader = c.req.header("x-csrf-token") ?? null;
  if (!isCsrfValid(c.req.method, cookieHeader, csrfHeader)) {
    throw Errors.forbidden("Missing or invalid CSRF token.");
  }
  await next();
};
