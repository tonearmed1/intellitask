import { describe, expect, it } from "vitest";
import {
  buildTaskTree,
  collectSubtreeIds,
  flattenTaskTree,
  isAncestor,
} from "../../worker/services/tasks/tree";
import type { Task, TaskDependency } from "@shared/types";

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

describe("buildTaskTree", () => {
  it("nests children under their parent at arbitrary depth", () => {
    const tasks = [
      makeTask({ id: "root", parentTaskId: null, sortOrder: 0 }),
      makeTask({ id: "child", parentTaskId: "root", sortOrder: 0 }),
      makeTask({ id: "grandchild", parentTaskId: "child", sortOrder: 0 }),
    ];
    const tree = buildTaskTree(tasks, []);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("root");
    expect(tree[0].children[0].id).toBe("child");
    expect(tree[0].children[0].children[0].id).toBe("grandchild");
  });

  it("orders siblings by sortOrder", () => {
    const tasks = [
      makeTask({ id: "b", sortOrder: 1 }),
      makeTask({ id: "a", sortOrder: 0 }),
      makeTask({ id: "c", sortOrder: 2 }),
    ];
    const tree = buildTaskTree(tasks, []);
    expect(tree.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("promotes orphaned rows (dangling parentTaskId) to root instead of dropping them", () => {
    const tasks = [makeTask({ id: "orphan", parentTaskId: "does-not-exist" })];
    const tree = buildTaskTree(tasks, []);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("orphan");
  });

  it("marks a task blocked when a dependency is not done or cancelled", () => {
    const tasks = [
      makeTask({ id: "prereq", status: "todo" }),
      makeTask({ id: "dependent" }),
    ];
    const deps: TaskDependency[] = [
      { id: "dep1", taskId: "dependent", dependsOnTaskId: "prereq", createdAt: "" },
    ];
    const tree = buildTaskTree(tasks, deps);
    const dependent = tree.find((t) => t.id === "dependent")!;
    expect(dependent.blockedByIncomplete).toBe(true);
    expect(dependent.dependsOn).toEqual([
      { dependencyId: "dep1", taskId: "prereq", title: "prereq" },
    ]);
  });

  it("does not consider a task blocked once its dependency is done", () => {
    const tasks = [
      makeTask({ id: "prereq", status: "done" }),
      makeTask({ id: "dependent" }),
    ];
    const deps: TaskDependency[] = [
      { id: "dep1", taskId: "dependent", dependsOnTaskId: "prereq", createdAt: "" },
    ];
    const tree = buildTaskTree(tasks, deps);
    expect(tree.find((t) => t.id === "dependent")!.blockedByIncomplete).toBe(false);
  });

  it("treats a cancelled dependency as resolved (no longer blocking)", () => {
    const tasks = [
      makeTask({ id: "prereq", status: "cancelled" }),
      makeTask({ id: "dependent" }),
    ];
    const deps: TaskDependency[] = [
      { id: "dep1", taskId: "dependent", dependsOnTaskId: "prereq", createdAt: "" },
    ];
    const tree = buildTaskTree(tasks, deps);
    expect(tree.find((t) => t.id === "dependent")!.blockedByIncomplete).toBe(false);
  });
});

describe("flattenTaskTree", () => {
  it("flattens depth-first", () => {
    const tasks = [
      makeTask({ id: "a", sortOrder: 0 }),
      makeTask({ id: "a1", parentTaskId: "a", sortOrder: 0 }),
      makeTask({ id: "b", sortOrder: 1 }),
    ];
    const flat = flattenTaskTree(buildTaskTree(tasks, []));
    expect(flat.map((t) => t.id)).toEqual(["a", "a1", "b"]);
  });
});

describe("collectSubtreeIds", () => {
  it("collects a task and all of its descendants", () => {
    const tasks = [
      makeTask({ id: "root" }),
      makeTask({ id: "child1", parentTaskId: "root" }),
      makeTask({ id: "child2", parentTaskId: "root" }),
      makeTask({ id: "grandchild", parentTaskId: "child1" }),
      makeTask({ id: "unrelated" }),
    ];
    const ids = collectSubtreeIds(tasks, "root");
    expect(new Set(ids)).toEqual(new Set(["root", "child1", "child2", "grandchild"]));
  });
});

describe("isAncestor", () => {
  it("returns true when the candidate is the task itself or an ancestor", () => {
    const tasks = [
      makeTask({ id: "root" }),
      makeTask({ id: "child", parentTaskId: "root" }),
      makeTask({ id: "grandchild", parentTaskId: "child" }),
    ];
    expect(isAncestor(tasks, "root", "grandchild")).toBe(true);
    expect(isAncestor(tasks, "root", "root")).toBe(true);
  });

  it("returns false for unrelated tasks", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];
    expect(isAncestor(tasks, "a", "b")).toBe(false);
  });
});
