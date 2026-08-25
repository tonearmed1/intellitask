import { Hono } from "hono";
import { z } from "zod";
import { parseJsonBody } from "../lib/validation";
import type { AppEnv } from "../types/hono";
import { addDependency, removeDependency } from "../services/tasks/taskService";

export const dependenciesRoutes = new Hono<AppEnv>();

const createDependencySchema = z.object({
  taskId: z.string().min(1),
  dependsOnTaskId: z.string().min(1),
});

dependenciesRoutes.post("/", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, createDependencySchema);
  const dependency = await addDependency(db, body.taskId, body.dependsOnTaskId);
  return c.json({ dependency }, 201);
});

dependenciesRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  await removeDependency(db, c.req.param("id"));
  return c.json({ ok: true });
});
