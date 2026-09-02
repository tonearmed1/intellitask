import { Hono } from "hono";
import { z } from "zod";
import { priorityEnum } from "@shared/ai-schema";
import { parseJsonBody } from "../lib/validation";
import { nowIso } from "../lib/ids";
import type { AppEnv } from "../types/hono";
import {
  answerProjectQuestion,
  confirmAssumption,
  createProjectWithAiPlan,
  createQuickTask,
  deleteProject,
  getProjectDetail,
  listProjects,
  updateProject,
} from "../services/projects/projectService";
import {
  applyImproveMissingTaskSuggestion,
  applyReviewMissingTask,
  improveProjectWithAi,
  reviewProjectWithAi,
  suggestNextActionsForProject,
} from "../services/projects/aiActions";

export const projectsRoutes = new Hono<AppEnv>();

const createProjectSchema = z.object({
  mode: z.enum(["quick", "ai"]),
  title: z.string().min(1).max(200),
  deadline: z.string().max(40).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  priority: priorityEnum.optional(),
  notes: z.string().max(5000).nullable().optional(),
});

projectsRoutes.get("/", async (c) => {
  const db = c.get("db");
  const currentDate = c.req.query("date") ?? nowIso().slice(0, 10);
  const list = await listProjects(db, currentDate);
  return c.json({ projects: list });
});

projectsRoutes.post("/", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, createProjectSchema);

  if (body.mode === "quick") {
    const detail = await createQuickTask(db, {
      title: body.title,
      priority: body.priority,
      dueDate: body.deadline ?? null,
      notes: body.notes ?? null,
    });
    return c.json(detail, 201);
  }

  const detail = await createProjectWithAiPlan(
    db,
    c.get("appEnv"),
    {
      title: body.title,
      deadline: body.deadline ?? null,
      description: body.description ?? null,
      location: body.location ?? null,
      priority: body.priority ?? "medium",
      notes: body.notes ?? null,
    },
    c.req.raw.signal,
  );
  return c.json(detail, 201);
});

projectsRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const detail = await getProjectDetail(db, c.req.param("id"));
  return c.json(detail);
});

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  deadline: z.string().max(40).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  priority: priorityEnum.optional(),
  notes: z.string().max(5000).nullable().optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
});

projectsRoutes.patch("/:id", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, updateProjectSchema);
  const project = await updateProject(db, c.req.param("id"), body);
  return c.json({ project });
});

projectsRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  await deleteProject(db, c.req.param("id"));
  return c.json({ ok: true });
});

const answerQuestionSchema = z.object({ answer: z.string().min(1).max(1000) });

projectsRoutes.post("/:id/questions/:questionId/answer", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, answerQuestionSchema);
  const project = await answerProjectQuestion(
    db,
    c.req.param("id"),
    c.req.param("questionId"),
    body.answer,
  );
  return c.json({ project });
});

const assumptionSchema = z.object({
  confirmed: z.boolean(),
  text: z.string().max(500).optional(),
});

projectsRoutes.post("/:id/assumptions/:assumptionId", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, assumptionSchema);
  const project = await confirmAssumption(
    db,
    c.req.param("id"),
    c.req.param("assumptionId"),
    body.confirmed,
    body.text,
  );
  return c.json({ project });
});

projectsRoutes.post("/:id/review", async (c) => {
  const db = c.get("db");
  const review = await reviewProjectWithAi(db, c.get("appEnv"), c.req.param("id"), c.req.raw.signal);
  return c.json({ review });
});

const applyMissingTaskSchema = z.object({
  title: z.string().min(1).max(200),
  reason: z.string().max(500).default(""),
  suggestedWorkstream: z.string().max(200).nullable().default(null),
  priority: priorityEnum.default("medium"),
});

projectsRoutes.post("/:id/review/apply-task", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, applyMissingTaskSchema);
  await applyReviewMissingTask(db, c.req.param("id"), body);
  const detail = await getProjectDetail(db, c.req.param("id"));
  return c.json(detail);
});

projectsRoutes.post("/:id/next-actions", async (c) => {
  const db = c.get("db");
  const actions = await suggestNextActionsForProject(
    db,
    c.get("appEnv"),
    c.req.param("id"),
    c.req.raw.signal,
  );
  return c.json(actions);
});

projectsRoutes.post("/:id/improve", async (c) => {
  const db = c.get("db");
  const suggestions = await improveProjectWithAi(db, c.get("appEnv"), c.req.param("id"), c.req.raw.signal);
  return c.json(suggestions);
});

const applyImproveSchema = z.object({
  type: z.literal("missing_task"),
  title: z.string().min(1).max(200),
  description: z.string().max(500).default(""),
});

projectsRoutes.post("/:id/improve/apply", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, applyImproveSchema);
  await applyImproveMissingTaskSuggestion(db, c.req.param("id"), body.title, body.description);
  const detail = await getProjectDetail(db, c.req.param("id"));
  return c.json(detail);
});
