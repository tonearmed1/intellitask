import { describe, expect, it } from "vitest";
import { flattenAiTaskNodes, resolveDependencyTitles } from "../../worker/services/tasks/aiToRows";
import type { AiTaskNode } from "@shared/ai-schema";

function node(title: string, overrides: Partial<AiTaskNode> = {}): AiTaskNode {
  return {
    title,
    description: "",
    priority: "medium",
    estimatedEffort: "",
    suggestedDueDate: null,
    reason: "",
    dependencies: [],
    requiresResearch: false,
    taskType: "task",
    subtasks: [],
    ...overrides,
  };
}

describe("flattenAiTaskNodes", () => {
  it("flattens a nested tree into rows with correct parent links", () => {
    const nodes = [
      node("Workstream", {
        subtasks: [node("Task A"), node("Task B", { subtasks: [node("Subtask B1")] })],
      }),
    ];
    const rows = flattenAiTaskNodes(nodes, {
      projectId: "proj_1",
      parentTaskId: null,
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    expect(rows).toHaveLength(4);
    const workstream = rows.find((r) => r.title === "Workstream")!;
    expect(workstream.parentTaskId).toBeNull();

    const taskA = rows.find((r) => r.title === "Task A")!;
    expect(taskA.parentTaskId).toBe(workstream.id);

    const subtaskB1 = rows.find((r) => r.title === "Subtask B1")!;
    const taskB = rows.find((r) => r.title === "Task B")!;
    expect(subtaskB1.parentTaskId).toBe(taskB.id);
  });

  it("assigns increasing sortOrder within each sibling group", () => {
    const nodes = [node("First"), node("Second"), node("Third")];
    const rows = flattenAiTaskNodes(nodes, {
      projectId: "proj_1",
      parentTaskId: null,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 1, 2]);
  });

  it("marks item-type nodes with itemState 'need'", () => {
    const nodes = [node("Chargers", { taskType: "item" })];
    const rows = flattenAiTaskNodes(nodes, {
      projectId: "proj_1",
      parentTaskId: null,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(rows[0].itemState).toBe("need");
    expect(rows[0].taskType).toBe("item");
  });

  it("falls back to a default title when the AI gives an empty one", () => {
    const rows = flattenAiTaskNodes([node("   ")], {
      projectId: "proj_1",
      parentTaskId: null,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(rows[0].title).toBe("Untitled task");
  });
});

describe("resolveDependencyTitles", () => {
  it("resolves a dependency title to the matching row id, case-insensitively", () => {
    const nodes = [
      node("Design banners"),
      node("Print banners", { dependencies: ["design banners"] }),
    ];
    const rows = flattenAiTaskNodes(nodes, {
      projectId: "proj_1",
      parentTaskId: null,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    const deps = resolveDependencyTitles(rows, "2026-01-01T00:00:00.000Z");
    expect(deps).toHaveLength(1);
    const designRow = rows.find((r) => r.title === "Design banners")!;
    const printRow = rows.find((r) => r.title === "Print banners")!;
    expect(deps[0]).toMatchObject({ taskId: printRow.id, dependsOnTaskId: designRow.id });
  });

  it("silently drops a dependency title that matches nothing", () => {
    const rows = flattenAiTaskNodes([node("Solo task", { dependencies: ["Nonexistent task"] })], {
      projectId: "proj_1",
      parentTaskId: null,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    const deps = resolveDependencyTitles(rows, "2026-01-01T00:00:00.000Z");
    expect(deps).toHaveLength(0);
  });

  it("can resolve against pre-existing tasks passed in separately", () => {
    const rows = flattenAiTaskNodes([node("New subtask", { dependencies: ["Existing task"] })], {
      projectId: "proj_1",
      parentTaskId: null,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    const deps = resolveDependencyTitles(rows, "2026-01-01T00:00:00.000Z", [
      { id: "task_existing", title: "Existing task" },
    ]);
    expect(deps).toHaveLength(1);
    expect(deps[0].dependsOnTaskId).toBe("task_existing");
  });

  it("never creates a self-dependency even if a node names itself", () => {
    const rows = flattenAiTaskNodes([node("Self referential", { dependencies: ["Self referential"] })], {
      projectId: "proj_1",
      parentTaskId: null,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    const deps = resolveDependencyTitles(rows, "2026-01-01T00:00:00.000Z");
    expect(deps).toHaveLength(0);
  });
});
