import { desc, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  aiRuns,
  contextEntries,
  milestones,
  projectResearch,
  projects,
  researchSources,
  taskDependencies,
  tasks,
} from "../../db/schema";
import { rowToContextEntry, rowToMilestone, rowToProject, rowToTask } from "../../db/mappers";
import { newId, nowIso } from "../../lib/ids";
import { sanitizePlainText } from "../../lib/sanitize";
import { Errors } from "../../lib/errors";
import type { Env } from "../../types/env";
import { getAiProvider } from "../ai";
import type { AiCallMeta } from "../ai/provider";
import type { AiTaskNode } from "@shared/ai-schema";
import type {
  Assumption,
  Milestone,
  PlanQuestion,
  Project,
  ProjectWithStats,
  Task,
  TaskDependency,
  TaskPriority,
  TaskWithChildren,
} from "@shared/types";
import { computeProjectStats } from "../tasks/completion";
import { buildTaskTree } from "../tasks/tree";
import { flattenAiTaskNodes, resolveDependencyTitles } from "../tasks/aiToRows";
import { selectRelevantContext } from "../context/relevance";
import { findSimilarProjects } from "../memory/similarProjects";
import { getResearchProvider, shouldResearch } from "../research";
import { getSettings } from "../settings/settingsService";

export interface CreateProjectAiInput {
  title: string;
  deadline: string | null;
  description: string | null;
  location: string | null;
  priority: TaskPriority;
  notes: string | null;
}

export interface ProjectDetail {
  project: Project;
  tree: TaskWithChildren[];
  milestones: Milestone[];
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

/** Wraps synthetic workstream nodes so they can be flattened with the same task-tree logic as real subtasks. */
function workstreamsToRootNodes(
  workstreams: { title: string; description: string; tasks: AiTaskNode[] }[],
): AiTaskNode[] {
  return workstreams.map((ws) => ({
    title: ws.title,
    description: ws.description,
    priority: "medium",
    estimatedEffort: "",
    suggestedDueDate: null,
    reason: "",
    dependencies: [],
    requiresResearch: false,
    taskType: "task",
    subtasks: ws.tasks,
  }));
}

export async function createProjectWithAiPlan(
  db: Database,
  env: Env,
  input: CreateProjectAiInput,
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  const currentDate = nowIso().slice(0, 10);
  const settings = await getSettings(db);
  const provider = getAiProvider(env, settings.aiProvider, settings.aiModel);

  const contextRows = await db.select().from(contextEntries);
  const allContext = contextRows.map(rowToContextEntry);
  const queryText = `${input.title} ${input.description ?? ""}`;
  const relevantContext = selectRelevantContext(allContext, queryText, 6).map((c) => ({
    title: c.title,
    content: c.content,
    category: c.category,
  }));

  const similarProjects = await findSimilarProjects(db, queryText, null, 2);

  let researchSnippets: { title: string; url: string; extract: string }[] = [];
  let rawResearchResults: { title: string; url: string; extract: string }[] = [];
  if (settings.allowWebResearch && shouldResearch(queryText)) {
    const researchProvider = getResearchProvider(env);
    rawResearchResults = await researchProvider.search(input.title, 4);
    researchSnippets = rawResearchResults;
  }

  // The AI call happens before any DB write. If it fails, nothing has been
  // created — no placeholder row to clean up — and the failure is still
  // logged (with project_id left null, since no project exists).
  const projectId = newId("proj");
  const start = Date.now();
  let plan;
  let aiMeta: AiCallMeta;
  try {
    const result = await provider.generateProject(
      {
        title: input.title,
        deadline: input.deadline,
        description: input.description,
        location: input.location,
        priority: input.priority,
        currentDate,
        relevantContext,
        similarProjects,
        research: researchSnippets,
      },
      { signal },
    );
    plan = result.data;
    aiMeta = result.meta;
  } catch (err) {
    await logAiRun(
      db,
      "generateProject",
      provider.name,
      settings.aiModel,
      null,
      null,
      false,
      err instanceof Error ? err.message : String(err),
      null,
      null,
      Date.now() - start,
    );
    throw err;
  }

  const timestamp = nowIso();
  const assumptions: Assumption[] = plan.assumptions.map((text) => ({
    id: newId("asm"),
    text,
    confirmed: false,
  }));
  const questions: PlanQuestion[] = plan.questions.map((question) => ({
    id: newId("q"),
    question,
    answer: null,
    answeredAt: null,
  }));

  const rootNodes = workstreamsToRootNodes(plan.workstreams);
  const rows = flattenAiTaskNodes(rootNodes, {
    projectId,
    parentTaskId: null,
    timestamp,
  });
  const taskRowsToInsert = rows.map(({ dependencyTitles: _dependencyTitles, ...row }) => row);
  const dependencyRows = resolveDependencyTitles(rows, timestamp);
  const milestoneRows = plan.suggestedMilestones.map((m, index) => ({
    id: newId("mile"),
    projectId,
    title: sanitizePlainText(m.title, 200),
    description: m.description ? sanitizePlainText(m.description, 500) : null,
    dueDate: m.dueDate,
    completed: false,
    source: "ai_generated" as const,
    sortOrder: index,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  // Every write for this plan lands in one transaction: either the whole
  // project (row + tasks + dependencies + milestones + research links)
  // exists, or none of it does.
  await db.transaction(async (tx) => {
    await tx.insert(projects).values({
      id: projectId,
      title: sanitizePlainText(input.title, 200),
      description: input.description ? sanitizePlainText(input.description, 2000) : null,
      deadline: input.deadline,
      location: input.location ? sanitizePlainText(input.location, 200) : null,
      priority: input.priority,
      notes: input.notes ? sanitizePlainText(input.notes, 5000) : null,
      status: "active",
      isQuickTask: false,
      projectSummary: sanitizePlainText(plan.projectSummary, 1000),
      assumptions,
      questions,
      risks: plan.risks,
      missingInformation: plan.missingInformation,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    if (taskRowsToInsert.length > 0) await tx.insert(tasks).values(taskRowsToInsert);
    if (dependencyRows.length > 0) await tx.insert(taskDependencies).values(dependencyRows);
    if (milestoneRows.length > 0) await tx.insert(milestones).values(milestoneRows);

    for (const r of rawResearchResults) {
      const sourceId = newId("rsrc");
      await tx.insert(researchSources).values({
        id: sourceId,
        query: sanitizePlainText(input.title, 300),
        sourceUrl: r.url,
        title: sanitizePlainText(r.title, 300),
        extract: sanitizePlainText(r.extract, 1500),
        researchedAt: timestamp,
        providerName: getResearchProvider(env).name,
      });
      await tx.insert(projectResearch).values({
        id: newId("preg"),
        projectId,
        researchSourceId: sourceId,
        taskId: null,
        createdAt: timestamp,
      });
    }
  });

  // Logged after the transaction commits, now that the project row it
  // references actually exists.
  await logAiRun(
    db,
    "generateProject",
    aiMeta.provider,
    aiMeta.model,
    projectId,
    null,
    true,
    null,
    aiMeta.promptTokens,
    aiMeta.completionTokens,
    aiMeta.durationMs,
  );

  return getProjectDetail(db, projectId);
}

export async function createQuickTask(
  db: Database,
  input: { title: string; priority?: TaskPriority; dueDate?: string | null; notes?: string | null },
): Promise<ProjectDetail> {
  const timestamp = nowIso();
  const projectId = newId("proj");
  const taskId = newId("task");
  const title = sanitizePlainText(input.title, 200);

  await db.transaction(async (tx) => {
    await tx.insert(projects).values({
      id: projectId,
      title,
      description: null,
      deadline: input.dueDate ?? null,
      location: null,
      priority: input.priority ?? "medium",
      notes: null,
      status: "active",
      isQuickTask: true,
      projectSummary: null,
      assumptions: [],
      questions: [],
      risks: [],
      missingInformation: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await tx.insert(tasks).values({
      id: taskId,
      projectId,
      parentTaskId: null,
      title,
      description: null,
      status: "todo",
      priority: input.priority ?? "medium",
      dueDate: input.dueDate ?? null,
      startDate: null,
      estimatedEffort: null,
      notes: input.notes ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      source: "user",
      aiGenerated: false,
      researchSupported: false,
      sortOrder: 0,
      taskType: "task",
      itemState: null,
      tags: [],
      reason: null,
      requiresResearch: false,
    });
  });

  return getProjectDetail(db, projectId);
}

export async function getProjectDetail(db: Database, projectId: string): Promise<ProjectDetail> {
  const [projectRow] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!projectRow) throw Errors.notFound("Project");

  const taskRows = await db.select().from(tasks).where(eq(tasks.projectId, projectId));

  // task_dependencies only stores task ids, not project id, so filter client-side.
  const taskIds = new Set(taskRows.map((t) => t.id));
  const allDeps =
    taskRows.length === 0
      ? []
      : (await db.select().from(taskDependencies)).filter((d) => taskIds.has(d.taskId));

  const milestoneRows = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId))
    .orderBy(milestones.sortOrder);

  const mappedTasks: Task[] = taskRows.map(rowToTask);
  const mappedDeps: TaskDependency[] = allDeps.map((d) => ({
    id: d.id,
    taskId: d.taskId,
    dependsOnTaskId: d.dependsOnTaskId,
    createdAt: d.createdAt,
  }));

  return {
    project: rowToProject(projectRow),
    tree: buildTaskTree(mappedTasks, mappedDeps),
    milestones: milestoneRows.map(rowToMilestone),
  };
}

export async function listProjects(
  db: Database,
  currentDate: string,
): Promise<ProjectWithStats[]> {
  const projectRows = await db.select().from(projects).orderBy(desc(projects.updatedAt));
  const allTasks = await db.select().from(tasks);
  const allMilestones = await db.select().from(milestones).orderBy(milestones.sortOrder);

  return projectRows.map((p) => {
    const projectTasks = allTasks.filter((t) => t.projectId === p.id).map(rowToTask);
    const stats = computeProjectStats(projectTasks, currentDate);
    const nextMilestone =
      allMilestones
        .filter((m) => m.projectId === p.id && !m.completed && m.dueDate)
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
        .map(rowToMilestone)[0] ?? null;

    return {
      ...rowToProject(p),
      taskCount: stats.taskCount,
      completedCount: stats.completedCount,
      overdueCount: stats.overdueCount,
      nextMilestone,
    };
  });
}

export async function updateProject(
  db: Database,
  projectId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    deadline: string | null;
    location: string | null;
    priority: TaskPriority;
    notes: string | null;
    status: Project["status"];
  }>,
): Promise<Project> {
  const [existing] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!existing) throw Errors.notFound("Project");

  await db
    .update(projects)
    .set({
      title: patch.title !== undefined ? sanitizePlainText(patch.title, 200) : existing.title,
      description:
        patch.description !== undefined
          ? patch.description
            ? sanitizePlainText(patch.description, 2000)
            : null
          : existing.description,
      deadline: patch.deadline !== undefined ? patch.deadline : existing.deadline,
      location:
        patch.location !== undefined
          ? patch.location
            ? sanitizePlainText(patch.location, 200)
            : null
          : existing.location,
      priority: patch.priority ?? existing.priority,
      notes:
        patch.notes !== undefined
          ? patch.notes
            ? sanitizePlainText(patch.notes, 5000)
            : null
          : existing.notes,
      status: patch.status ?? existing.status,
      updatedAt: nowIso(),
    })
    .where(eq(projects.id, projectId));

  const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
  return rowToProject(row);
}

export async function deleteProject(db: Database, projectId: string): Promise<void> {
  const [existing] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!existing) throw Errors.notFound("Project");
  await db.delete(projects).where(eq(projects.id, projectId));
}

export async function answerProjectQuestion(
  db: Database,
  projectId: string,
  questionId: string,
  answer: string,
): Promise<Project> {
  const [existing] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!existing) throw Errors.notFound("Project");
  const project = rowToProject(existing);
  const updatedQuestions = project.questions.map((q) =>
    q.id === questionId
      ? { ...q, answer: sanitizePlainText(answer, 1000), answeredAt: nowIso() }
      : q,
  );
  await db
    .update(projects)
    .set({ questions: updatedQuestions, updatedAt: nowIso() })
    .where(eq(projects.id, projectId));
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
  return rowToProject(row);
}

export async function confirmAssumption(
  db: Database,
  projectId: string,
  assumptionId: string,
  confirmed: boolean,
  newText?: string,
): Promise<Project> {
  const [existing] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!existing) throw Errors.notFound("Project");
  const project = rowToProject(existing);
  const updated = project.assumptions.map((a) =>
    a.id === assumptionId
      ? { ...a, confirmed, text: newText !== undefined ? sanitizePlainText(newText, 500) : a.text }
      : a,
  );
  await db
    .update(projects)
    .set({ assumptions: updated, updatedAt: nowIso() })
    .where(eq(projects.id, projectId));
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
  return rowToProject(row);
}
