import type { Task } from "@shared/types";
import { isOverdue } from "./deadlines";

export interface ProjectTaskStats {
  taskCount: number;
  completedCount: number;
  overdueCount: number;
  completionPercent: number;
}

/** Counts only leaf-relevant, non-cancelled tasks toward the denominator so a
 * project isn't penalised for tasks the user explicitly cancelled. */
export function computeProjectStats(
  tasks: Task[],
  currentDate: string,
): ProjectTaskStats {
  const relevant = tasks.filter((t) => t.status !== "cancelled");
  const completedCount = relevant.filter((t) => t.status === "done").length;
  const overdueCount = tasks.filter((t) =>
    isOverdue(t.dueDate, currentDate, t.status),
  ).length;
  const taskCount = relevant.length;
  const completionPercent =
    taskCount === 0 ? 0 : Math.round((completedCount / taskCount) * 100);

  return { taskCount, completedCount, overdueCount, completionPercent };
}
