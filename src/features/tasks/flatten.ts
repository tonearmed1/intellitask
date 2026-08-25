import type { Task, TaskWithChildren } from "@shared/types";

/** Depth-first flatten of a task tree, used for dependency pickers and completion math on the client. */
export function flattenTree(nodes: TaskWithChildren[]): Task[] {
  const out: Task[] = [];
  const walk = (list: TaskWithChildren[]) => {
    for (const n of list) {
      const { children: _children, dependsOn: _dependsOn, blockedByIncomplete: _b, ...task } = n;
      out.push(task);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function computeProjectPercent(tasks: Task[]): number {
  const relevant = tasks.filter((t) => t.status !== "cancelled");
  if (relevant.length === 0) return 0;
  const completed = relevant.filter((t) => t.status === "done").length;
  return Math.round((completed / relevant.length) * 100);
}
