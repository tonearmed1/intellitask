import { Hono } from "hono";
import { z } from "zod";
import { priorityEnum } from "@shared/ai-schema";
import { parseJsonBody } from "../lib/validation";
import type { AppEnv } from "../types/hono";
import {
  createTask,
  deleteTask,
  duplicateTask,
  getTask,
  moveTask,
  reorderSiblings,
  updateTask,
} from "../services/tasks/taskService";
import { expandTaskWithAi } from "../services/projects/aiActions";

export const tasksRoutes = new Hono<AppEnv>();

const statusEnum = z.enum(["todo", "in_progress", "waiting", "blocked", "done", "cancelled"]);
const itemStateEnum = z.enum(["need", "ordered", "ready", "packed"]);

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  parentTaskId: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  priority: priorityEnum.optional(),
  dueDate: z.string().max(40).nullable().optional(),
  startDate: z.string().max(40).nullable().optional(),
  estimatedEffort: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  taskType: z.enum(["task", "item"]).optional(),
});

tasksRoutes.post("/", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, createTaskSchema);
  const task = await createTask(db, body);
  return c.json({ task }, 201);
});

tasksRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const task = await getTask(db, c.req.param("id"));
  return c.json({ task });
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  dueDate: z.string().max(40).nullable().optional(),
  startDate: z.string().max(40).nullable().optional(),
  estimatedEffort: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  itemState: itemStateEnum.nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
});

tasksRoutes.patch("/:id", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, updateTaskSchema);
  const task = await updateTask(db, c.req.param("id"), body);
  return c.json({ task });
});

tasksRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  await deleteTask(db, c.req.param("id"));
  return c.json({ ok: true });
});

tasksRoutes.post("/:id/duplicate", async (c) => {
  const db = c.get("db");
  const task = await duplicateTask(db, c.req.param("id"));
  return c.json({ task }, 201);
});

const moveTaskSchema = z.object({
  parentTaskId: z.string().min(1).nullable(),
  index: z.number().int().min(0),
});

tasksRoutes.post("/:id/move", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, moveTaskSchema);
  const task = await moveTask(db, c.req.param("id"), body.parentTaskId, body.index);
  return c.json({ task });
});

const reorderSchema = z.object({
  projectId: z.string().min(1),
  parentTaskId: z.string().min(1).nullable(),
  orderedTaskIds: z.array(z.string().min(1)),
});

tasksRoutes.post("/reorder", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, reorderSchema);
  await reorderSiblings(db, body.projectId, body.parentTaskId, body.orderedTaskIds);
  return c.json({ ok: true });
});

tasksRoutes.post("/:id/expand", async (c) => {
  const db = c.get("db");
  const deeper = c.req.query("deeper") === "true";
  const detail = await expandTaskWithAi(db, c.env, c.req.param("id"), deeper, c.req.raw.signal);
  return c.json(detail);
});
