import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./setup";
import { createProjectWithAiPlan, getProjectDetail } from "../../worker/services/projects/projectService";
import {
  applyReviewMissingTask,
  improveProjectWithAi,
  reviewProjectWithAi,
  suggestNextActionsForProject,
} from "../../worker/services/projects/aiActions";

describe("AI review / next actions / improve", () => {
  let ctx: TestContext;
  let projectId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const detail = await createProjectWithAiPlan(ctx.db, ctx.env, {
      title: "Prepare for EICMA",
      deadline: "2026-11-03",
      description: null,
      location: null,
      priority: "medium",
      notes: null,
    });
    projectId = detail.project.id;
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  it("reviews the project and surfaces missing tasks/risks without mutating it", async () => {
    const before = await getProjectDetail(ctx.db, projectId);
    const review = await reviewProjectWithAi(ctx.db, ctx.env, projectId);

    expect(Array.isArray(review.missingTasks)).toBe(true);
    expect(Array.isArray(review.risks)).toBe(true);

    // Review is read-only — nothing should have been written to the tree.
    const after = await getProjectDetail(ctx.db, projectId);
    expect(countTasks(after.tree)).toBe(countTasks(before.tree));
  });

  it("applying a review's missing-task suggestion actually creates the task", async () => {
    const before = await getProjectDetail(ctx.db, projectId);
    const beforeCount = countTasks(before.tree);

    await applyReviewMissingTask(ctx.db, projectId, {
      title: "Confirm badge collection point",
      reason: "Easy to forget",
      suggestedWorkstream: null,
      priority: "medium",
    });

    const after = await getProjectDetail(ctx.db, projectId);
    expect(countTasks(after.tree)).toBe(beforeCount + 1);
    expect(flatten(after.tree).some((t) => t.title === "Confirm badge collection point")).toBe(
      true,
    );
  });

  it("suggests next actions from real open tasks in the project", async () => {
    const result = await suggestNextActionsForProject(ctx.db, ctx.env, projectId);
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions.length).toBeLessThanOrEqual(5);
  });

  it("returns improvement suggestions without mutating the project", async () => {
    const before = await getProjectDetail(ctx.db, projectId);
    const result = await improveProjectWithAi(ctx.db, ctx.env, projectId);
    expect(Array.isArray(result.suggestions)).toBe(true);
    const after = await getProjectDetail(ctx.db, projectId);
    expect(countTasks(after.tree)).toBe(countTasks(before.tree));
  });
});

function countTasks(tree: { children: unknown[] }[]): number {
  return flatten(tree).length;
}

function flatten<T extends { children: unknown[] }>(tree: T[]): T[] {
  const out: T[] = [];
  const walk = (nodes: T[]) => {
    for (const n of nodes) {
      out.push(n);
      walk(n.children as T[]);
    }
  };
  walk(tree);
  return out;
}
