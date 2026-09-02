import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { taskDependencies, tasks } from "../../db/schema";
import { rowToTask } from "../../db/mappers";
import { newId, nowIso } from "../../lib/ids";
import { sanitizePlainText } from "../../lib/sanitize";
import { Errors } from "../../lib/errors";
import type {
  ItemState,
  Task,
  TaskDependency,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@shared/types";
import { isAncestor } from "./tree";

export interface CreateTaskInput {
  projectId: string;
  parentTaskId?: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedEffort?: string | null;
  notes?: string | null;
  taskType?: TaskType;
  source?: "user" | "ai_generated" | "ai_suggested";
  reason?: string | null;
}

async function nextSortOrder(
  db: Database,
  projectId: string,
  parentTaskId: string | null,
): Promise<number> {
  const siblings = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  const filtered = siblings.filter((t) => (t.parentTaskId ?? null) === parentTaskId);
  return filtered.length === 0 ? 0 : Math.max(...filtered.map((t) => t.sortOrder)) + 1;
}

export async function getTask(db: Database, taskId: string): Promise<Task> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!row) throw Errors.notFound("Task");
  return rowToTask(row);
}

export async function createTask(db: Database, input: CreateTaskInput): Promise<Task> {
  const timestamp = nowIso();
  const id = newId("task");
  const parentTaskId = input.parentTaskId ?? null;
  const sortOrder = await nextSortOrder(db, input.projectId, parentTaskId);
  const taskType = input.taskType ?? "task";

  await db.insert(tasks).values({
    id,
    projectId: input.projectId,
    parentTaskId,
    title: sanitizePlainText(input.title, 200),
    description: input.description ? sanitizePlainText(input.description, 2000) : null,
    status: "todo",
    priority: input.priority ?? "medium",
    dueDate: input.dueDate ?? null,
    startDate: input.startDate ?? null,
    estimatedEffort: input.estimatedEffort ?? null,
    notes: input.notes ? sanitizePlainText(input.notes, 5000) : null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    source: input.source ?? "user",
    aiGenerated: input.source === "ai_generated" || input.source === "ai_suggested",
    researchSupported: false,
    sortOrder,
    taskType,
    itemState: taskType === "item" ? "need" : null,
    tags: [],
    reason: input.reason ? sanitizePlainText(input.reason, 500) : null,
    requiresResearch: false,
  });

  return getTask(db, id);
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedEffort?: string | null;
  notes?: string | null;
  itemState?: ItemState | null;
  tags?: string[];
}

export async function updateTask(
  db: Database,
  taskId: string,
  patch: UpdateTaskInput,
): Promise<Task> {
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!existing) throw Errors.notFound("Task");

  const nextStatus = patch.status ?? existing.status;
  const wasDone = existing.status === "done";
  const isNowDone = nextStatus === "done";
  const completedAt = isNowDone && !wasDone ? nowIso() : isNowDone ? existing.completedAt : null;

  await db
    .update(tasks)
    .set({
      title: patch.title !== undefined ? sanitizePlainText(patch.title, 200) : existing.title,
      description:
        patch.description !== undefined
          ? patch.description
            ? sanitizePlainText(patch.description, 2000)
            : null
          : existing.description,
      status: nextStatus,
      priority: patch.priority ?? existing.priority,
      dueDate: patch.dueDate !== undefined ? patch.dueDate : existing.dueDate,
      startDate: patch.startDate !== undefined ? patch.startDate : existing.startDate,
      estimatedEffort:
        patch.estimatedEffort !== undefined ? patch.estimatedEffort : existing.estimatedEffort,
      notes:
        patch.notes !== undefined
          ? patch.notes
            ? sanitizePlainText(patch.notes, 5000)
            : null
          : existing.notes,
      itemState: patch.itemState !== undefined ? patch.itemState : existing.itemState,
      tags: patch.tags !== undefined ? patch.tags : existing.tags,
      completedAt,
      updatedAt: nowIso(),
    })
    .where(eq(tasks.id, taskId));

  return getTask(db, taskId);
}

export async function deleteTask(db: Database, taskId: string): Promise<void> {
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!existing) throw Errors.notFound("Task");
  await db.delete(tasks).where(eq(tasks.id, taskId));
}

export async function duplicateTask(db: Database, taskId: string): Promise<Task> {
  const [original] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!original) throw Errors.notFound("Task");

  const allProjectTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, original.projectId));

  const idMap = new Map<string, string>();
  const queued: (typeof original)[] = [];
  const timestamp = nowIso();

  function cloneSubtree(sourceId: string, newParentId: string | null): void {
    const source = allProjectTasks.find((t) => t.id === sourceId);
    if (!source) return;
    const clonedId = newId("task");
    idMap.set(sourceId, clonedId);
    queued.push({ ...source, id: clonedId, parentTaskId: newParentId });
    const children = allProjectTasks.filter((t) => t.parentTaskId === sourceId);
    for (const child of children) cloneSubtree(child.id, clonedId);
  }

  cloneSubtree(taskId, original.parentTaskId);

  const rootCloneId = idMap.get(taskId);
  const sortOrder = await nextSortOrder(db, original.projectId, original.parentTaskId);
  for (const row of queued) {
    const isRoot = row.id === rootCloneId;
    await db.insert(tasks).values({
      ...row,
      title: isRoot ? `${row.title} (copy)` : row.title,
      status: "todo",
      completedAt: null,
      source: "user",
      aiGenerated: false,
      researchSupported: false,
      sortOrder: isRoot ? sortOrder : row.sortOrder,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const newRootId = idMap.get(taskId);
  if (!newRootId) throw Errors.internal("Failed to duplicate task.");
  return getTask(db, newRootId);
}

export async function reorderSiblings(
  db: Database,
  projectId: string,
  parentTaskId: string | null,
  orderedTaskIds: string[],
): Promise<void> {
  const siblings = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  const validIds = new Set(
    siblings.filter((t) => (t.parentTaskId ?? null) === parentTaskId).map((t) => t.id),
  );
  for (let i = 0; i < orderedTaskIds.length; i++) {
    const id = orderedTaskIds[i];
    if (!validIds.has(id)) continue;
    await db.update(tasks).set({ sortOrder: i, updatedAt: nowIso() }).where(eq(tasks.id, id));
  }
}

export async function moveTask(
  db: Database,
  taskId: string,
  newParentTaskId: string | null,
  newIndex: number,
): Promise<Task> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw Errors.notFound("Task");

  if (newParentTaskId) {
    if (newParentTaskId === taskId) throw Errors.badRequest("A task cannot be its own parent.");
    const allProjectTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, task.projectId));
    if (isAncestor(allProjectTasks.map(rowToTask), taskId, newParentTaskId)) {
      throw Errors.badRequest("Cannot move a task inside its own subtree.");
    }
  }

  await db
    .update(tasks)
    .set({ parentTaskId: newParentTaskId, updatedAt: nowIso() })
    .where(eq(tasks.id, taskId));

  const siblings = await db.select().from(tasks).where(eq(tasks.projectId, task.projectId));
  const orderedIds = siblings
    .filter((t) => (t.parentTaskId ?? null) === newParentTaskId && t.id !== taskId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => t.id);
  orderedIds.splice(Math.max(0, Math.min(newIndex, orderedIds.length)), 0, taskId);

  await reorderSiblings(db, task.projectId, newParentTaskId, orderedIds);
  return getTask(db, taskId);
}

export async function addDependency(
  db: Database,
  taskId: string,
  dependsOnTaskId: string,
): Promise<TaskDependency> {
  if (taskId === dependsOnTaskId) {
    throw Errors.badRequest("A task cannot depend on itself.");
  }
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  const [dependsOn] = await db.select().from(tasks).where(eq(tasks.id, dependsOnTaskId));
  if (!task || !dependsOn) throw Errors.notFound("Task");
  if (task.projectId !== dependsOn.projectId) {
    throw Errors.badRequest("Dependencies must be within the same project.");
  }

  const existingDeps = await db.select().from(taskDependencies);
  const wouldCycle = createsCycle(existingDeps, taskId, dependsOnTaskId);
  if (wouldCycle) {
    throw Errors.badRequest("That dependency would create a circular reference.");
  }

  const id = newId("tdep");
  await db.insert(taskDependencies).values({
    id,
    taskId,
    dependsOnTaskId,
    createdAt: nowIso(),
  });
  const [row] = await db.select().from(taskDependencies).where(eq(taskDependencies.id, id));
  return row;
}

function createsCycle(
  deps: { taskId: string; dependsOnTaskId: string }[],
  taskId: string,
  newDependsOnId: string,
): boolean {
  // Would `taskId` become reachable from `newDependsOnId` by following
  // existing dependency edges? If so, adding this edge creates a cycle.
  const graph = new Map<string, string[]>();
  for (const d of deps) {
    const list = graph.get(d.taskId) ?? [];
    list.push(d.dependsOnTaskId);
    graph.set(d.taskId, list);
  }
  const visited = new Set<string>();
  const stack = [newDependsOnId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(graph.get(current) ?? []));
  }
  return false;
}

export async function removeDependency(db: Database, dependencyId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(taskDependencies)
    .where(eq(taskDependencies.id, dependencyId));
  if (!existing) throw Errors.notFound("Dependency");
  await db.delete(taskDependencies).where(eq(taskDependencies.id, dependencyId));
}
