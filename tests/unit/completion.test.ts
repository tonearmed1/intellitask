import { describe, expect, it } from "vitest";
import { computeProjectStats } from "../../worker/services/tasks/completion";
import type { Task } from "@shared/types";

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    projectId: "proj_1",
    parentTaskId: null,
    title: overrides.id,
    description: null,
    status: "todo",
    priority: "medium",
    dueDate: null,
    startDate: null,
    estimatedEffort: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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
    ...overrides,
  };
}

describe("computeProjectStats", () => {
  it("returns zeroed stats for an empty task list", () => {
    const stats = computeProjectStats([], "2026-01-05");
    expect(stats).toEqual({
      taskCount: 0,
      completedCount: 0,
      overdueCount: 0,
      completionPercent: 0,
    });
  });

  it("counts completed tasks and computes percent complete", () => {
    const tasks = [
      makeTask({ id: "a", status: "done" }),
      makeTask({ id: "b", status: "done" }),
      makeTask({ id: "c", status: "todo" }),
      makeTask({ id: "d", status: "todo" }),
    ];
    const stats = computeProjectStats(tasks, "2026-01-05");
    expect(stats.taskCount).toBe(4);
    expect(stats.completedCount).toBe(2);
    expect(stats.completionPercent).toBe(50);
  });

  it("excludes cancelled tasks from the denominator", () => {
    const tasks = [
      makeTask({ id: "a", status: "done" }),
      makeTask({ id: "b", status: "cancelled" }),
    ];
    const stats = computeProjectStats(tasks, "2026-01-05");
    expect(stats.taskCount).toBe(1);
    expect(stats.completionPercent).toBe(100);
  });

  it("counts overdue open tasks but not done/cancelled ones", () => {
    const tasks = [
      makeTask({ id: "a", status: "todo", dueDate: "2026-01-01" }),
      makeTask({ id: "b", status: "done", dueDate: "2026-01-01" }),
      makeTask({ id: "c", status: "todo", dueDate: "2026-02-01" }),
    ];
    const stats = computeProjectStats(tasks, "2026-01-05");
    expect(stats.overdueCount).toBe(1);
  });
});
