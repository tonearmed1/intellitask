import type { AiTaskNode } from "@shared/ai-schema";
import type {
  ItemState,
  Source,
  Task,
  TaskPriority,
  TaskType,
} from "@shared/types";
import { newId } from "../../lib/ids";
import { toJsonText } from "../../lib/json";
import { sanitizePlainText } from "../../lib/sanitize";

/** A task row plus the raw (title-based) dependency references the AI gave us, still unresolved to ids. */
export interface FlattenedTaskRow {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: "todo";
  priority: TaskPriority;
  dueDate: string | null;
  startDate: string | null;
  estimatedEffort: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: null;
  source: Source;
  aiGenerated: boolean;
  researchSupported: boolean;
  sortOrder: number;
  taskType: TaskType;
  itemState: ItemState | null;
  tags: string;
  reason: string | null;
  requiresResearch: boolean;
  dependencyTitles: string[];
}

export interface FlattenOptions {
  projectId: string;
  parentTaskId: string | null;
  timestamp: string;
  startSortOrder?: number;
  source?: Source;
  researchedTitles?: Set<string>;
}

export function flattenAiTaskNodes(
  nodes: AiTaskNode[],
  opts: FlattenOptions,
): FlattenedTaskRow[] {
  const source = opts.source ?? "ai_generated";
  const rows: FlattenedTaskRow[] = [];

  function walk(list: AiTaskNode[], parentTaskId: string | null, startOrder: number) {
    list.forEach((node, index) => {
      const id = newId("task");
      const itemState: ItemState | null =
        node.taskType === "item" ? "need" : null;
      rows.push({
        id,
        projectId: opts.projectId,
        parentTaskId,
        title: sanitizePlainText(node.title, 200) || "Untitled task",
        description: node.description ? sanitizePlainText(node.description, 2000) : null,
        status: "todo",
        priority: node.priority,
        dueDate: node.suggestedDueDate,
        startDate: null,
        estimatedEffort: node.estimatedEffort || null,
        notes: null,
        createdAt: opts.timestamp,
        updatedAt: opts.timestamp,
        completedAt: null,
        source,
        aiGenerated: true,
        researchSupported: opts.researchedTitles?.has(node.title.toLowerCase()) ?? false,
        sortOrder: startOrder + index,
        taskType: node.taskType ?? "task",
        itemState,
        tags: toJsonText([]),
        reason: node.reason ? sanitizePlainText(node.reason, 500) : null,
        requiresResearch: node.requiresResearch,
        dependencyTitles: node.dependencies,
      });
      if (node.subtasks.length > 0) walk(node.subtasks, id, 0);
    });
  }

  walk(nodes, opts.parentTaskId, opts.startSortOrder ?? 0);
  return rows;
}

export interface ResolvedDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  createdAt: string;
}

/**
 * Resolves each row's raw dependency titles (as written by the AI) to
 * actual task ids, matching case-insensitively against the newly-created
 * rows plus any pre-existing tasks in the project. Unmatched titles are
 * dropped silently — the AI's dependency titles are advisory, not
 * authoritative, so a miss should never block plan creation.
 */
export function resolveDependencyTitles(
  rows: FlattenedTaskRow[],
  timestamp: string,
  existingTasks: Pick<Task, "id" | "title">[] = [],
): ResolvedDependency[] {
  const byTitle = new Map<string, string>();
  for (const t of existingTasks) byTitle.set(t.title.trim().toLowerCase(), t.id);
  for (const r of rows) byTitle.set(r.title.trim().toLowerCase(), r.id);

  const resolved: ResolvedDependency[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const rawTitle of row.dependencyTitles) {
      const targetId = byTitle.get(rawTitle.trim().toLowerCase());
      if (!targetId || targetId === row.id) continue;
      const key = `${row.id}:${targetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push({
        id: newId("tdep"),
        taskId: row.id,
        dependsOnTaskId: targetId,
        createdAt: timestamp,
      });
    }
  }
  return resolved;
}
