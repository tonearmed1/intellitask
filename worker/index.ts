import { Hono } from "hono";
import { createDb } from "./db/client";
import { AppError } from "./lib/errors";
import { requireAuth } from "./middleware/auth";
import { requireCsrf } from "./middleware/csrf";
import { authRoutes } from "./routes/auth";
import { projectsRoutes } from "./routes/projects";
import { tasksRoutes } from "./routes/tasks";
import { dependenciesRoutes } from "./routes/dependencies";
import { milestonesRoutes } from "./routes/milestones";
import { contextRoutes } from "./routes/context";
import { inboxRoutes } from "./routes/inbox";
import { searchRoutes } from "./routes/search";
import { settingsRoutes } from "./routes/settings";
import { dashboardRoutes } from "./routes/dashboard";
import type { AppEnv } from "./types/hono";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});

app.route("/api/auth", authRoutes);

const api = new Hono<AppEnv>();
api.use("*", requireCsrf);
api.use("*", requireAuth);
api.route("/projects", projectsRoutes);
api.route("/tasks", tasksRoutes);
api.route("/dependencies", dependenciesRoutes);
api.route("/milestones", milestonesRoutes);
api.route("/context", contextRoutes);
api.route("/inbox", inboxRoutes);
api.route("/search", searchRoutes);
api.route("/settings", settingsRoutes);
api.route("/", dashboardRoutes);

app.route("/api", api);

app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found." } }, 404));

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status as never);
  }
  console.error("Unhandled worker error:", err);
  return c.json(
    { error: { code: "internal_error", message: "Something went wrong. Please try again." } },
    500,
  );
});

export default app;
