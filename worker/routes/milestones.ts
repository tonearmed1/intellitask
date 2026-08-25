import { Hono } from "hono";
import { z } from "zod";
import { parseJsonBody } from "../lib/validation";
import type { AppEnv } from "../types/hono";
import {
  createMilestone,
  deleteMilestone,
  updateMilestone,
} from "../services/milestones/milestoneService";

export const milestonesRoutes = new Hono<AppEnv>();

const createMilestoneSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  dueDate: z.string().max(40).nullable().optional(),
});

milestonesRoutes.post("/", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, createMilestoneSchema);
  const milestone = await createMilestone(db, body);
  return c.json({ milestone }, 201);
});

const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  dueDate: z.string().max(40).nullable().optional(),
  completed: z.boolean().optional(),
});

milestonesRoutes.patch("/:id", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, updateMilestoneSchema);
  const milestone = await updateMilestone(db, c.req.param("id"), body);
  return c.json({ milestone });
});

milestonesRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  await deleteMilestone(db, c.req.param("id"));
  return c.json({ ok: true });
});
