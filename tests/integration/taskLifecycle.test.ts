import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./setup";
import { createQuickTask, getProjectDetail } from "../../worker/services/projects/projectService";
import {
  addDependency,
  createTask,
  deleteTask,
  duplicateTask,
  removeDependency,
  updateTask,
} from "../../worker/services/tasks/taskService";
import { expandTaskWithAi } from "../../worker/services/projects/aiActions";
import { Errors } from "../../worker/lib/errors";

describe("manual task lifecycle", () => {
  let ctx: TestContext;
  let projectId: string;
  let rootTaskId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const detail = await createQuickTask(ctx.db, { title: "Call Marco" });
    projectId = detail.project.id;
    rootTaskId = detail.tree[0].id;
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  it("creates a project via the quick-task path with exactly one task", async () => {
    const detail = await getProjectDetail(ctx.db, projectId);
    expect(detail.project.isQuickTask).toBe(true);
    expect(detail.tree).toHaveLength(1);
    expect(detail.tree[0].title).toBe("Call Marco");
    expect(detail.tree[0].status).toBe("todo");
  });

  it("edits a task's fields", async () => {
    const updated = await updateTask(ctx.db, rootTaskId, {
      title: "Call Marco about venue",
      priority: "high",
      dueDate: "2026-09-01",
    });
    expect(updated.title).toBe("Call Marco about venue");
    expect(updated.priority).toBe("high");
    expect(updated.dueDate).toBe("2026-09-01");
  });

  it("marks a task complete and stamps completedAt", async () => {
    const updated = await updateTask(ctx.db, rootTaskId, { status: "done" });
    expect(updated.status).toBe("done");
    expect(updated.completedAt).not.toBeNull();
  });

  it("clears completedAt when reopened", async () => {
    const updated = await updateTask(ctx.db, rootTaskId, { status: "todo" });
    expect(updated.status).toBe("todo");
    expect(updated.completedAt).toBeNull();
  });

  it("adds a subtask under an existing task", async () => {
    const subtask = await createTask(ctx.db, {
      projectId,
      parentTaskId: rootTaskId,
      title: "Confirm phone number",
    });
    expect(subtask.parentTaskId).toBe(rootTaskId);

    const detail = await getProjectDetail(ctx.db, projectId);
    expect(detail.tree[0].children).toHaveLength(1);
    expect(detail.tree[0].children[0].title).toBe("Confirm phone number");
  });

  it("expands a task with the mock AI provider, appending real subtasks", async () => {
    const detail = await expandTaskWithAi(ctx.db, ctx.env, rootTaskId, false);
    const root = detail.tree.find((t) => t.id === rootTaskId)!;
    // 1 manually-added subtask from the previous test + AI-generated ones.
    expect(root.children.length).toBeGreaterThan(1);
    expect(root.children.some((c) => c.source === "ai_generated")).toBe(true);
  });

  it("duplicates a task as a new sibling with reset status", async () => {
    const original = await createTask(ctx.db, { projectId, title: "Original task" });
    await updateTask(ctx.db, original.id, { status: "done" });
    const copy = await duplicateTask(ctx.db, original.id);
    expect(copy.id).not.toBe(original.id);
    expect(copy.title).toBe("Original task (copy)");
    expect(copy.status).toBe("todo");
  });

  it("adds and removes a dependency between two tasks", async () => {
    const taskA = await createTask(ctx.db, { projectId, title: "Design banners" });
    const taskB = await createTask(ctx.db, { projectId, title: "Print banners" });

    const dep = await addDependency(ctx.db, taskB.id, taskA.id);
    expect(dep.taskId).toBe(taskB.id);
    expect(dep.dependsOnTaskId).toBe(taskA.id);

    let detail = await getProjectDetail(ctx.db, projectId);
    let printTask = findTask(detail.tree, taskB.id)!;
    expect(printTask.blockedByIncomplete).toBe(true);

    await removeDependency(ctx.db, dep.id);
    detail = await getProjectDetail(ctx.db, projectId);
    printTask = findTask(detail.tree, taskB.id)!;
    expect(printTask.blockedByIncomplete).toBe(false);
  });

  it("rejects a dependency that would create a cycle", async () => {
    const taskA = await createTask(ctx.db, { projectId, title: "A" });
    const taskB = await createTask(ctx.db, { projectId, title: "B" });
    await addDependency(ctx.db, taskB.id, taskA.id); // B depends on A
    await expect(addDependency(ctx.db, taskA.id, taskB.id)).rejects.toThrow();
  });

  it("deletes a task and cascades to its subtasks", async () => {
    const parent = await createTask(ctx.db, { projectId, title: "Parent to delete" });
    const child = await createTask(ctx.db, { projectId, parentTaskId: parent.id, title: "Child" });

    await deleteTask(ctx.db, parent.id);

    const detail = await getProjectDetail(ctx.db, projectId);
    expect(findTask(detail.tree, parent.id)).toBeUndefined();
    expect(findTask(detail.tree, child.id)).toBeUndefined();
  });

  it("throws a not-found error when deleting a task that doesn't exist", async () => {
    await expect(deleteTask(ctx.db, "task_does_not_exist")).rejects.toThrow(Errors.notFound().constructor);
  });
});

function findTask(
  tree: { id: string; children: unknown[] }[],
  id: string,
): { id: string; children: unknown[]; blockedByIncomplete?: boolean } | undefined {
  for (const node of tree) {
    if (node.id === id) return node as never;
    const found = findTask(node.children as typeof tree, id);
    if (found) return found;
  }
  return undefined;
}
