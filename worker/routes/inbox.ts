import { Hono } from "hono";
import { z } from "zod";
import { parseJsonBody } from "../lib/validation";
import type { AppEnv } from "../types/hono";
import {
  createInboxItem,
  dismissInboxItem,
  listInboxItems,
  resolveInboxItemAsTask,
} from "../services/inbox/inboxService";

export const inboxRoutes = new Hono<AppEnv>();

inboxRoutes.get("/", async (c) => {
  const db = c.get("db");
  const status = c.req.query("status") as "pending" | "resolved" | "dismissed" | undefined;
  const items = await listInboxItems(db, status);
  return c.json({ items });
});

const createSchema = z.object({ content: z.string().min(1).max(1000) });

inboxRoutes.post("/", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, createSchema);
  const item = await createInboxItem(db, body.content);
  return c.json({ item }, 201);
});

const resolveSchema = z.object({
  targetProjectId: z.string().min(1),
  targetParentTaskId: z.string().min(1).nullable().optional(),
});

inboxRoutes.post("/:id/resolve", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, resolveSchema);
  await resolveInboxItemAsTask(db, c.req.param("id"), body.targetProjectId, body.targetParentTaskId ?? null);
  return c.json({ ok: true });
});

inboxRoutes.post("/:id/dismiss", async (c) => {
  const db = c.get("db");
  await dismissInboxItem(db, c.req.param("id"));
  return c.json({ ok: true });
});
