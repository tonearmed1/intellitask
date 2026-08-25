import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./setup";
import { createQuickTask, getProjectDetail } from "../../worker/services/projects/projectService";
import {
  createInboxItem,
  dismissInboxItem,
  listInboxItems,
  resolveInboxItemAsTask,
} from "../../worker/services/inbox/inboxService";

describe("inbox workflow", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  it("captures a raw thought as a pending inbox item", async () => {
    const item = await createInboxItem(ctx.db, "Need spare battery labels for EICMA");
    expect(item.status).toBe("pending");
    expect(item.content).toBe("Need spare battery labels for EICMA");

    const list = await listInboxItems(ctx.db, "pending");
    expect(list.some((i) => i.id === item.id)).toBe(true);
  });

  it("suggests a matching project when the content overlaps an existing project title", async () => {
    const project = await createQuickTask(ctx.db, { title: "Prepare for EICMA trade show" });
    const item = await createInboxItem(ctx.db, "Book EICMA trade show hotel");
    expect(item.suggestedProjectId).toBe(project.project.id);
  });

  it("resolving an item creates a real task and marks it resolved", async () => {
    const project = await createQuickTask(ctx.db, { title: "Standalone project" });
    const item = await createInboxItem(ctx.db, "Buy extension cables");

    await resolveInboxItemAsTask(ctx.db, item.id, project.project.id, null);

    const detail = await getProjectDetail(ctx.db, project.project.id);
    expect(detail.tree.some((t) => t.title === "Buy extension cables")).toBe(true);

    const pending = await listInboxItems(ctx.db, "pending");
    expect(pending.some((i) => i.id === item.id)).toBe(false);
    const resolved = await listInboxItems(ctx.db, "resolved");
    expect(resolved.some((i) => i.id === item.id)).toBe(true);
  });

  it("dismissing an item marks it dismissed without creating a task", async () => {
    const item = await createInboxItem(ctx.db, "Random unrelated thought");
    await dismissInboxItem(ctx.db, item.id);

    const dismissed = await listInboxItems(ctx.db, "dismissed");
    expect(dismissed.some((i) => i.id === item.id)).toBe(true);
  });

  it("rejects resolving an item that was already resolved", async () => {
    const project = await createQuickTask(ctx.db, { title: "Another project" });
    const item = await createInboxItem(ctx.db, "One-time thing");
    await resolveInboxItemAsTask(ctx.db, item.id, project.project.id, null);
    await expect(
      resolveInboxItemAsTask(ctx.db, item.id, project.project.id, null),
    ).rejects.toThrow();
  });
});
