import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { requireAuth } from "@worker/middleware/auth";
import { requireCsrf } from "@worker/middleware/csrf";
import { AppError } from "@worker/lib/errors";
import type { Env } from "@worker/types/env";
import type { AppEnv } from "@worker/types/hono";

function buildApp(authDisabled: string) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    const env: Env = {
      AI_PROVIDER: "mock",
      AI_MODEL: "mock-v1",
      ALLOW_WEB_RESEARCH: "false",
      AUTH_DISABLED: authDisabled,
    };
    c.set("appEnv", env);
    await next();
  });
  app.use("*", requireCsrf);
  app.use("*", requireAuth);
  app.all("/whoami", (c) => c.json({ userId: c.get("userId") }));
  app.onError((err, c) =>
    err instanceof AppError
      ? c.json({ code: err.code }, err.status as never)
      : c.json({ code: "internal" }, 500),
  );
  return app;
}

describe("AUTH_DISABLED", () => {
  it("lets a cookie-less, CSRF-less request through as the owner", async () => {
    const app = buildApp("true");
    const get = await app.request("/whoami");
    expect(get.status).toBe(200);
    expect(await get.json()).toEqual({ userId: "owner" });

    const post = await app.request("/whoami", { method: "POST" });
    expect(post.status).toBe(200);
  });

  it("is case/whitespace tolerant", async () => {
    const res = await buildApp(" TRUE ").request("/whoami");
    expect(res.status).toBe(200);
  });

  it("still blocks anonymous requests when off", async () => {
    const res = await buildApp("false").request("/whoami");
    expect(res.status).toBe(401);
  });

  it("still enforces CSRF on mutations when off", async () => {
    const res = await buildApp("false").request("/whoami", { method: "POST" });
    expect(res.status).toBe(403);
  });
});
