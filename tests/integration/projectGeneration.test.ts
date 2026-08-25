import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./setup";
import {
  createProjectWithAiPlan,
  getProjectDetail,
} from "../../worker/services/projects/projectService";
import { aiRuns } from "../../worker/db/schema";
import { eq } from "drizzle-orm";

describe("AI project generation → D1 persistence", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  it("generates a plan with the mock provider and persists workstreams/tasks/milestones to D1", async () => {
    const detail = await createProjectWithAiPlan(ctx.db, ctx.env, {
      title: "Prepare for EICMA",
      deadline: "2026-11-03",
      description: null,
      location: null,
      priority: "medium",
      notes: null,
    });

    expect(detail.project.title).toBe("Prepare for EICMA");
    expect(detail.project.projectSummary).toBeTruthy();
    expect(detail.tree.length).toBeGreaterThan(3); // multiple workstreams
    expect(detail.milestones.length).toBeGreaterThan(0);

    // Re-fetch independently to prove it was actually saved, not just returned in-memory.
    const reloaded = await getProjectDetail(ctx.db, detail.project.id);
    expect(reloaded.tree.length).toBe(detail.tree.length);

    const totalTasks = countTasks(reloaded.tree);
    expect(totalTasks).toBeGreaterThan(10);
  });

  it("records a successful ai_runs entry for the generation", async () => {
    const detail = await createProjectWithAiPlan(ctx.db, ctx.env, {
      title: "Plan a 10-day trip to Japan",
      deadline: null,
      description: null,
      location: null,
      priority: "medium",
      notes: null,
    });

    const runs = await ctx.db
      .select()
      .from(aiRuns)
      .where(eq(aiRuns.projectId, detail.project.id));
    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0].operation).toBe("generateProject");
    expect(runs[0].success).toBe(true);
    expect(runs[0].provider).toBe("mock");
  });

  it("resolves title-based dependencies between generated tasks", async () => {
    const detail = await createProjectWithAiPlan(ctx.db, ctx.env, {
      title: "Prepare for EICMA",
      deadline: null,
      description: null,
      location: null,
      priority: "medium",
      notes: null,
    });
    const flat = countBlocked(detail.tree);
    // The mock EICMA plan includes "Print banners" depending on "Design banners".
    expect(flat).toBeGreaterThan(0);
  });
});

function countTasks(tree: { children: unknown[] }[]): number {
  let count = 0;
  const walk = (nodes: { children: unknown[] }[]) => {
    for (const n of nodes) {
      count += 1;
      walk(n.children as { children: unknown[] }[]);
    }
  };
  walk(tree);
  return count;
}

function countBlocked(tree: { blockedByIncomplete: boolean; children: unknown[] }[]): number {
  let count = 0;
  const walk = (nodes: { blockedByIncomplete: boolean; children: unknown[] }[]) => {
    for (const n of nodes) {
      if (n.blockedByIncomplete) count += 1;
      walk(n.children as typeof nodes);
    }
  };
  walk(tree);
  return count;
}
