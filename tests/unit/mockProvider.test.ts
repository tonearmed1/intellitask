import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../../worker/services/ai/mockProvider";
import { aiProjectPlanSchema } from "@shared/ai-schema";

const provider = new MockAIProvider();

const baseInput = {
  title: "Prepare for EICMA",
  deadline: "2026-11-03",
  description: null,
  location: null,
  priority: "medium" as const,
  currentDate: "2026-08-01",
  relevantContext: [],
  similarProjects: [],
  research: [],
};

describe("MockAIProvider.generateProject", () => {
  it("returns a plan that validates against the AI project plan schema", async () => {
    const result = await provider.generateProject(baseInput);
    const parsed = aiProjectPlanSchema.safeParse(result.data);
    expect(parsed.success).toBe(true);
  });

  it("produces multiple workstreams with real task breakdowns for a known event", async () => {
    const result = await provider.generateProject(baseInput);
    expect(result.data.workstreams.length).toBeGreaterThanOrEqual(4);
    const allTaskTitles = result.data.workstreams.flatMap((w) => w.tasks.map((t) => t.title));
    expect(allTaskTitles.length).toBeGreaterThan(10);
  });

  it("is deterministic for the same input", async () => {
    const first = await provider.generateProject(baseInput);
    const second = await provider.generateProject(baseInput);
    expect(first.data.workstreams.map((w) => w.title)).toEqual(
      second.data.workstreams.map((w) => w.title),
    );
  });

  it("produces a sensible generic breakdown for an arbitrary, non-domain-matched title", async () => {
    const result = await provider.generateProject({
      ...baseInput,
      title: "Reorganise the garage",
      deadline: null,
    });
    expect(result.data.workstreams.length).toBeGreaterThan(0);
    expect(result.data.workstreams.every((w) => w.tasks.length > 0)).toBe(true);
  });

  it("schedules suggested milestones backward from the deadline", async () => {
    const result = await provider.generateProject(baseInput);
    const datedMilestones = result.data.suggestedMilestones.filter((m) => m.dueDate);
    expect(datedMilestones.length).toBeGreaterThan(0);
    for (const m of datedMilestones) {
      expect(m.dueDate! <= baseInput.deadline!).toBe(true);
    }
  });
});

describe("MockAIProvider.expandTask", () => {
  it("returns a non-trivial, non-duplicate breakdown", async () => {
    const result = await provider.expandTask({
      projectTitle: "Prepare for EICMA",
      taskTitle: "Design merch",
      taskDescription: null,
      ancestorTitles: [],
      siblingTitles: [],
      currentDate: "2026-08-01",
      projectDeadline: null,
      relevantContext: [],
      deeper: false,
    });
    expect(result.data.subtasks.length).toBeGreaterThan(3);
    expect(result.data.subtasks.every((t) => t.title !== "Design merch")).toBe(true);
  });
});

describe("MockAIProvider.suggestNextActions", () => {
  it("never recommends a blocked task", async () => {
    const result = await provider.suggestNextActions({
      projectTitle: "Test",
      deadline: null,
      currentDate: "2026-01-01",
      candidateTasks: [
        { id: "t1", title: "Blocked task", priority: "critical", status: "todo", dueDate: null, estimatedEffort: null },
        { id: "t2", title: "Open task", priority: "low", status: "todo", dueDate: null, estimatedEffort: null },
      ],
      blockedTaskIds: new Set(["t1"]),
    });
    expect(result.data.actions.some((a) => a.taskId === "t1")).toBe(false);
  });

  it("returns at most 5 actions", async () => {
    const candidateTasks = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      title: `Task ${i}`,
      priority: "medium" as const,
      status: "todo" as const,
      dueDate: null,
      estimatedEffort: null,
    }));
    const result = await provider.suggestNextActions({
      projectTitle: "Test",
      deadline: null,
      currentDate: "2026-01-01",
      candidateTasks,
      blockedTaskIds: new Set(),
    });
    expect(result.data.actions.length).toBeLessThanOrEqual(5);
  });
});
