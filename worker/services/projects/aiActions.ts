import { eq } from "drizzle-orm";
import type { AiImproveSuggestions, AiNextActions, AiReview } from "@shared/ai-schema";
import type { TaskPriority } from "@shared/types";
import type { Env } from "../../types/env";
import type { Database } from "../../db/client";
import {
  aiRuns,
  contextEntries,
  projects,
  taskDependencies,
  tasks,
} from "../../db/schema";
import { rowToContextEntry, rowToTask } from "../../db/mappers";
import { newId, nowIso } from "../../lib/ids";
import { Errors } from "../../lib/errors";
import { getAiProvider } from "../ai";
import { getSettings } from "../settings/settingsService";
import { selectRelevantContext } from "../context/relevance";
import { buildTaskTree, flattenTaskTree } from "../tasks/tree";
import { flattenAiTaskNodes, resolveDependencyTitles } from "../tasks/aiToRows";
import { createTask } from "../tasks/taskService";
import { getProjectDetail, type ProjectDetail } from "./projectService";

async function loadProjectAndTasks(db: Database, projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw Errors.notFound("Project");
  const taskRows = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  return { project, taskRows };
}

async function logAiRun(
  db: Database,
  operation: string,
  provider: string,
  model: string,
  projectId: string | null,
  taskId: string | null,
  success: boolean,
  errorMessage: string | null,
  promptTokens: number | null,
  completionTokens: number | null,
  durationMs: number,
): Promise<void> {
  await db.insert(aiRuns).values({
    id: newId("run"),
    operation,
    provider,
    model,
    projectId,
    taskId,
    success,
    errorMessage,
    promptTokens,
    completionTokens,
    durationMs,
    createdAt: nowIso(),
  });
}

export async function expandTaskWithAi(
  db: Database,
  env: Env,
  taskId: string,
  deeper: boolean,
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw Errors.notFound("Task");
  const { project, taskRows } = await loadProjectAndTasks(db, task.projectId);

  const ancestorTitles: string[] = [];
  let currentParentId = task.parentTaskId;
  while (currentParentId) {
    const parent = taskRows.find((t) => t.id === currentParentId);
    if (!parent) break;
    ancestorTitles.unshift(parent.title);
    currentParentId = parent.parentTaskId;
  }
  const siblingTitles = taskRows
    .filter((t) => t.parentTaskId === task.parentTaskId && t.id !== task.id)
    .map((t) => t.title);

  const allContext = (await db.select().from(contextEntries)).map(rowToContextEntry);
  const relevantContext = selectRelevantContext(
    allContext,
    `${task.title} ${task.description ?? ""}`,
    5,
  ).map((c) => ({ title: c.title, content: c.content, category: c.category }));

  const settings = await getSettings(db);
  const provider = getAiProvider(env, settings.aiProvider, settings.aiModel);
  const start = Date.now();

  let subtasks;
  try {
    const result = await provider.expandTask(
      {
        projectTitle: project.title,
        taskTitle: task.title,
        taskDescription: task.description,
        ancestorTitles,
        siblingTitles,
        currentDate: nowIso().slice(0, 10),
        projectDeadline: project.deadline,
        relevantContext,
        deeper,
      },
      { signal },
    );
    subtasks = result.data.subtasks;
    await logAiRun(
      db,
      "expandTask",
      result.meta.provider,
      result.meta.model,
      project.id,
      taskId,
      true,
      null,
      result.meta.promptTokens,
      result.meta.completionTokens,
      result.meta.durationMs,
    );
  } catch (err) {
    await logAiRun(
      db,
      "expandTask",
      provider.name,
      settings.aiModel,
      project.id,
      taskId,
      false,
      err instanceof Error ? err.message : String(err),
      null,
      null,
      Date.now() - start,
    );
    throw err;
  }

  const existingChildren = taskRows.filter((t) => t.parentTaskId === taskId);
  const startSortOrder =
    existingChildren.length === 0 ? 0 : Math.max(...existingChildren.map((t) => t.sortOrder)) + 1;
  const timestamp = nowIso();

  const rows = flattenAiTaskNodes(subtasks, {
    projectId: project.id,
    parentTaskId: taskId,
    timestamp,
    startSortOrder,
    source: "ai_generated",
  });

  if (rows.length > 0) {
    const taskRowsToInsert = rows.map(({ dependencyTitles: _d, ...row }) => row);
    const existingForLookup = taskRows.map((t) => ({ id: t.id, title: t.title }));
    const dependencyRows = resolveDependencyTitles(rows, timestamp, existingForLookup);
    await db.transaction(async (tx) => {
      await tx.insert(tasks).values(taskRowsToInsert);
      if (dependencyRows.length > 0) await tx.insert(taskDependencies).values(dependencyRows);
    });
  }

  return getProjectDetail(db, project.id);
}

export async function reviewProjectWithAi(
  db: Database,
  env: Env,
  projectId: string,
  signal?: AbortSignal,
): Promise<AiReview> {
  const { project, taskRows } = await loadProjectAndTasks(db, projectId);
  const mappedTasks = taskRows.map(rowToTask);
  const deps = (await db.select().from(taskDependencies)).filter((d) =>
    mappedTasks.some((t) => t.id === d.taskId),
  );
  const tree = flattenTaskTree(buildTaskTree(mappedTasks, deps));

  const completedTaskTitles = tree.filter((t) => t.status === "done").map((t) => t.title);
  const incompleteTaskTitles = tree
    .filter((t) => t.status !== "done" && t.status !== "cancelled")
    .map((t) => t.title);
  const blockedTaskTitles = tree
    .filter((t) => t.status === "blocked" || t.status === "waiting" || t.blockedByIncomplete)
    .map((t) => t.title);

  const allContext = (await db.select().from(contextEntries)).map(rowToContextEntry);
  const relevantContext = selectRelevantContext(
    allContext,
    `${project.title} ${project.projectSummary ?? ""}`,
    5,
  ).map((c) => ({ title: c.title, content: c.content, category: c.category }));

  const settings = await getSettings(db);
  const provider = getAiProvider(env, settings.aiProvider, settings.aiModel);
  const start = Date.now();

  try {
    const result = await provider.reviewProject(
      {
        projectTitle: project.title,
        deadline: project.deadline,
        currentDate: nowIso().slice(0, 10),
        completedTaskTitles,
        incompleteTaskTitles,
        blockedTaskTitles,
        relevantContext,
      },
      { signal },
    );
    await logAiRun(
      db,
      "reviewProject",
      result.meta.provider,
      result.meta.model,
      projectId,
      null,
      true,
      null,
      result.meta.promptTokens,
      result.meta.completionTokens,
      result.meta.durationMs,
    );
    return result.data;
  } catch (err) {
    await logAiRun(
      db,
      "reviewProject",
      provider.name,
      settings.aiModel,
      projectId,
      null,
      false,
      err instanceof Error ? err.message : String(err),
      null,
      null,
      Date.now() - start,
    );
    throw err;
  }
}

export async function suggestNextActionsForProject(
  db: Database,
  env: Env,
  projectId: string,
  signal?: AbortSignal,
): Promise<AiNextActions> {
  const { project, taskRows } = await loadProjectAndTasks(db, projectId);
  const mappedTasks = taskRows.map(rowToTask);
  const deps = (await db.select().from(taskDependencies)).filter((d) =>
    mappedTasks.some((t) => t.id === d.taskId),
  );
  const tree = flattenTaskTree(buildTaskTree(mappedTasks, deps));
  const openTasks = tree.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const blockedIds = new Set(openTasks.filter((t) => t.blockedByIncomplete).map((t) => t.id));

  const settings = await getSettings(db);
  const provider = getAiProvider(env, settings.aiProvider, settings.aiModel);
  const start = Date.now();

  try {
    const result = await provider.suggestNextActions(
      {
        projectTitle: project.title,
        deadline: project.deadline,
        currentDate: nowIso().slice(0, 10),
        candidateTasks: openTasks.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          status: t.status,
          dueDate: t.dueDate,
          estimatedEffort: t.estimatedEffort,
        })),
        blockedTaskIds: blockedIds,
      },
      { signal },
    );
    await logAiRun(
      db,
      "suggestNextActions",
      result.meta.provider,
      result.meta.model,
      projectId,
      null,
      true,
      null,
      result.meta.promptTokens,
      result.meta.completionTokens,
      result.meta.durationMs,
    );
    return result.data;
  } catch (err) {
    await logAiRun(
      db,
      "suggestNextActions",
      provider.name,
      settings.aiModel,
      projectId,
      null,
      false,
      err instanceof Error ? err.message : String(err),
      null,
      null,
      Date.now() - start,
    );
    throw err;
  }
}

export async function improveProjectWithAi(
  db: Database,
  env: Env,
  projectId: string,
  signal?: AbortSignal,
): Promise<AiImproveSuggestions> {
  const { project, taskRows } = await loadProjectAndTasks(db, projectId);
  const mappedTasks = taskRows.map(rowToTask);
  const roots = mappedTasks.filter((t) => t.parentTaskId === null);
  const workstreamSummaries = roots.map((root) => {
    const descendantIds = new Set<string>();
    const stack = [root.id];
    while (stack.length > 0) {
      const id = stack.pop();
      const children = mappedTasks.filter((t) => t.parentTaskId === id);
      for (const c of children) {
        descendantIds.add(c.id);
        stack.push(c.id);
      }
    }
    return {
      title: root.title,
      taskTitles: mappedTasks.filter((t) => descendantIds.has(t.id)).map((t) => t.title),
    };
  });

  const settings = await getSettings(db);
  const provider = getAiProvider(env, settings.aiProvider, settings.aiModel);
  const start = Date.now();

  try {
    const result = await provider.improveProject(
      {
        projectTitle: project.title,
        deadline: project.deadline,
        currentDate: nowIso().slice(0, 10),
        workstreamSummaries,
      },
      { signal },
    );
    await logAiRun(
      db,
      "improveProject",
      result.meta.provider,
      result.meta.model,
      projectId,
      null,
      true,
      null,
      result.meta.promptTokens,
      result.meta.completionTokens,
      result.meta.durationMs,
    );
    return result.data;
  } catch (err) {
    await logAiRun(
      db,
      "improveProject",
      provider.name,
      settings.aiModel,
      projectId,
      null,
      false,
      err instanceof Error ? err.message : String(err),
      null,
      null,
      Date.now() - start,
    );
    throw err;
  }
}

export async function applyReviewMissingTask(
  db: Database,
  projectId: string,
  input: {
    title: string;
    reason: string;
    suggestedWorkstream: string | null;
    priority: TaskPriority;
  },
): Promise<void> {
  const taskRows = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  const roots = taskRows.filter((t) => t.parentTaskId === null);
  const targetWorkstream = input.suggestedWorkstream
    ? roots.find((r) => r.title.toLowerCase() === input.suggestedWorkstream!.toLowerCase())
    : undefined;

  await createTask(db, {
    projectId,
    parentTaskId: targetWorkstream?.id ?? null,
    title: input.title,
    reason: input.reason,
    priority: input.priority,
    source: "ai_suggested",
  });
}

export async function applyImproveMissingTaskSuggestion(
  db: Database,
  projectId: string,
  title: string,
  description: string,
): Promise<void> {
  await createTask(db, {
    projectId,
    parentTaskId: null,
    title,
    reason: description,
    source: "ai_suggested",
  });
}
