import { Hono } from "hono";
import { z } from "zod";
import { CONTEXT_CATEGORIES, type ContextCategory } from "@shared/types";
import { parseJsonBody } from "../lib/validation";
import type { AppEnv } from "../types/hono";
import {
  createContextEntry,
  deleteContextEntry,
  listContextEntries,
  updateContextEntry,
} from "../services/context/contextService";

export const contextRoutes = new Hono<AppEnv>();

const categoryEnum = z.enum(
  CONTEXT_CATEGORIES as [ContextCategory, ...ContextCategory[]],
);

contextRoutes.get("/", async (c) => {
  const db = c.get("db");
  const entries = await listContextEntries(db);
  return c.json({ entries });
});

const createSchema = z.object({
  category: categoryEnum,
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  tags: z.array(z.string().max(50)).optional(),
});

contextRoutes.post("/", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, createSchema);
  const entry = await createContextEntry(db, body);
  return c.json({ entry }, 201);
});

const updateSchema = z.object({
  category: categoryEnum.optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  tags: z.array(z.string().max(50)).optional(),
});

contextRoutes.patch("/:id", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, updateSchema);
  const entry = await updateContextEntry(db, c.req.param("id"), body);
  return c.json({ entry });
});

contextRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  await deleteContextEntry(db, c.req.param("id"));
  return c.json({ ok: true });
});
