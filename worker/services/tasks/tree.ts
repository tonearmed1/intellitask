import type {
  Task,
  TaskDependency,
  TaskDependencyRef,
  TaskWithChildren,
} from "@shared/types";

const RESOLVED_STATUSES = new Set(["done", "cancelled"]);

/**
 * Builds the nested task hierarchy from flat DB rows. Handles arbitrary
 * nesting depth (workstreams are simply the parentTaskId === null tasks).
 * Orphaned rows (parent id points at a task not in `tasks`, which shouldn't
 * happen given FK constraints but is defended against for resilience) are
 * promoted to root level rather than silently dropped.
 */
export function buildTaskTree(
  tasks: Task[],
  dependencies: TaskDependency[],
): TaskWithChildren[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const dependsOnByTask = new Map<string, TaskDependencyRef[]>();
  for (const dep of dependencies) {
    const target = byId.get(dep.dependsOnTaskId);
    if (!target) continue;
    const list = dependsOnByTask.get(dep.taskId) ?? [];
    list.push({ dependencyId: dep.id, taskId: dep.dependsOnTaskId, title: target.title });
    dependsOnByTask.set(dep.taskId, list);
  }

  const childrenByParent = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const parentKey = t.parentTaskId && byId.has(t.parentTaskId) ? t.parentTaskId : null;
    const list = childrenByParent.get(parentKey) ?? [];
    list.push(t);
    childrenByParent.set(parentKey, list);
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function computeBlocked(taskId: string): boolean {
    const deps = dependsOnByTask.get(taskId) ?? [];
    return deps.some((dep) => {
      const target = byId.get(dep.taskId);
      return target ? !RESOLVED_STATUSES.has(target.status) : false;
    });
  }

  function build(parentId: string | null): TaskWithChildren[] {
    const nodes = childrenByParent.get(parentId) ?? [];
    return nodes.map((t) => ({
      ...t,
      dependsOn: dependsOnByTask.get(t.id) ?? [],
      blockedByIncomplete: computeBlocked(t.id),
      children: build(t.id),
    }));
  }

  return build(null);
}

/** Flattens a tree back into an ordered list (depth-first), useful for rendering/export. */
export function flattenTaskTree(nodes: TaskWithChildren[]): TaskWithChildren[] {
  const out: TaskWithChildren[] = [];
  const walk = (list: TaskWithChildren[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** Collects a task id and every descendant id (for cascading UI confirmations). */
export function collectSubtreeIds(tasks: Task[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const t of tasks) {
    if (!t.parentTaskId) continue;
    const list = childrenByParent.get(t.parentTaskId) ?? [];
    list.push(t.id);
    childrenByParent.set(t.parentTaskId, list);
  }
  const ids: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id) continue;
    ids.push(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return ids;
}

/** True if `candidateAncestorId` is `taskId` itself or one of its ancestors — used to block cyclic re-parenting. */
export function isAncestor(
  tasks: Task[],
  taskId: string,
  candidateAncestorId: string,
): boolean {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let current: string | null = candidateAncestorId;
  while (current) {
    if (current === taskId) return true;
    current = byId.get(current)?.parentTaskId ?? null;
  }
  return false;
}
