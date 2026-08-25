// Zod schemas describing the structured JSON contract between the AI providers
// and the rest of the app. Used both to validate/repair model output on the
// worker and to type the data flowing to the client. Never trust model output
// without parsing it through these schemas first.
import { z } from "zod";

export const priorityEnum = z.enum(["low", "medium", "high", "critical"]);

// Recursive task node returned by the AI. `z.lazy` allows arbitrary nesting
// depth, matching the product requirement that hierarchy not be capped at 2
// levels.
export interface AiTaskNode {
  title: string;
  description: string;
  priority: z.infer<typeof priorityEnum>;
  estimatedEffort: string;
  suggestedDueDate: string | null;
  reason: string;
  dependencies: string[];
  requiresResearch: boolean;
  taskType?: "task" | "item";
  subtasks: AiTaskNode[];
}

export const aiTaskNodeSchema: z.ZodType<AiTaskNode> = z.lazy(() =>
  z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).default(""),
    priority: priorityEnum.default("medium"),
    estimatedEffort: z.string().max(50).default(""),
    suggestedDueDate: z
      .string()
      .max(40)
      .nullable()
      .default(null),
    reason: z.string().max(500).default(""),
    dependencies: z.array(z.string().max(200)).default([]),
    requiresResearch: z.boolean().default(false),
    taskType: z.enum(["task", "item"]).default("task").optional(),
    subtasks: z.array(aiTaskNodeSchema).default([]),
  }),
);

export const aiWorkstreamSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
  tasks: z.array(aiTaskNodeSchema).default([]),
});

export const aiMilestoneSchema = z.object({
  title: z.string().min(1).max(200),
  dueDate: z.string().max(40).nullable().default(null),
  description: z.string().max(500).default(""),
});

export const aiProjectPlanSchema = z.object({
  projectSummary: z.string().max(1000).default(""),
  assumptions: z.array(z.string().max(500)).default([]),
  questions: z.array(z.string().max(500)).default([]),
  workstreams: z.array(aiWorkstreamSchema).default([]),
  risks: z.array(z.string().max(500)).default([]),
  missingInformation: z.array(z.string().max(500)).default([]),
  suggestedMilestones: z.array(aiMilestoneSchema).default([]),
});
export type AiProjectPlan = z.infer<typeof aiProjectPlanSchema>;

export const aiExpandResultSchema = z.object({
  subtasks: z.array(aiTaskNodeSchema).default([]),
});
export type AiExpandResult = z.infer<typeof aiExpandResultSchema>;

export const aiReviewSchema = z.object({
  missingTasks: z
    .array(
      z.object({
        title: z.string().max(200),
        reason: z.string().max(500).default(""),
        suggestedWorkstream: z.string().max(200).nullable().default(null),
        priority: priorityEnum.default("medium"),
      }),
    )
    .default([]),
  risks: z.array(z.string().max(500)).default([]),
  upcomingDeadlines: z
    .array(
      z.object({
        taskTitle: z.string().max(200),
        dueDate: z.string().max(40),
        note: z.string().max(300).default(""),
      }),
    )
    .default([]),
  blockers: z
    .array(
      z.object({
        taskTitle: z.string().max(200),
        reason: z.string().max(500).default(""),
      }),
    )
    .default([]),
  suggestedNextActions: z.array(z.string().max(300)).default([]),
});
export type AiReview = z.infer<typeof aiReviewSchema>;

export const aiNextActionsSchema = z.object({
  actions: z
    .array(
      z.object({
        taskId: z.string().max(100).nullable().default(null),
        taskTitle: z.string().max(200),
        explanation: z.string().max(400).default(""),
      }),
    )
    .min(0)
    .max(5)
    .default([]),
});
export type AiNextActions = z.infer<typeof aiNextActionsSchema>;

export const aiImproveSuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        id: z.string().max(100),
        type: z.enum([
          "missing_workstream",
          "missing_task",
          "redundant_task",
          "reorder",
          "unrealistic_deadline",
          "missing_dependency",
        ]),
        title: z.string().max(200),
        description: z.string().max(500).default(""),
        targetTaskTitle: z.string().max(200).nullable().default(null),
      }),
    )
    .default([]),
});
export type AiImproveSuggestions = z.infer<typeof aiImproveSuggestionSchema>;
