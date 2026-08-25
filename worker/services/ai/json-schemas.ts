// Hand-written JSON Schemas mirroring shared/ai-schema.ts, used to force
// structured output from the model providers (Anthropic tool-use input
// schema / OpenAI structured outputs). additionalProperties:false and fully
// "required" properties everywhere so both providers' strict validation
// accepts the schema.

const taskNodeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
    estimatedEffort: { type: "string" },
    suggestedDueDate: { type: ["string", "null"] },
    reason: { type: "string" },
    dependencies: { type: "array", items: { type: "string" } },
    requiresResearch: { type: "boolean" },
    taskType: { type: "string", enum: ["task", "item"] },
    subtasks: { type: "array", items: { $ref: "#/$defs/taskNode" } },
  },
  required: [
    "title",
    "description",
    "priority",
    "estimatedEffort",
    "suggestedDueDate",
    "reason",
    "dependencies",
    "requiresResearch",
    "taskType",
    "subtasks",
  ],
} as const;

export const generateProjectJsonSchema = {
  name: "submit_project_plan",
  description: "Submit the generated project plan.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      projectSummary: { type: "string" },
      assumptions: { type: "array", items: { type: "string" } },
      questions: { type: "array", items: { type: "string" } },
      workstreams: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            tasks: { type: "array", items: { $ref: "#/$defs/taskNode" } },
          },
          required: ["title", "description", "tasks"],
        },
      },
      risks: { type: "array", items: { type: "string" } },
      missingInformation: { type: "array", items: { type: "string" } },
      suggestedMilestones: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            dueDate: { type: ["string", "null"] },
            description: { type: "string" },
          },
          required: ["title", "dueDate", "description"],
        },
      },
    },
    required: [
      "projectSummary",
      "assumptions",
      "questions",
      "workstreams",
      "risks",
      "missingInformation",
      "suggestedMilestones",
    ],
    $defs: { taskNode: taskNodeSchema },
  },
};

export const expandTaskJsonSchema = {
  name: "submit_subtasks",
  description: "Submit the generated subtasks for the task being expanded.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      subtasks: { type: "array", items: { $ref: "#/$defs/taskNode" } },
    },
    required: ["subtasks"],
    $defs: { taskNode: taskNodeSchema },
  },
};

export const reviewProjectJsonSchema = {
  name: "submit_project_review",
  description: "Submit the project review findings.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      missingTasks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            reason: { type: "string" },
            suggestedWorkstream: { type: ["string", "null"] },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
            },
          },
          required: ["title", "reason", "suggestedWorkstream", "priority"],
        },
      },
      risks: { type: "array", items: { type: "string" } },
      upcomingDeadlines: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            taskTitle: { type: "string" },
            dueDate: { type: "string" },
            note: { type: "string" },
          },
          required: ["taskTitle", "dueDate", "note"],
        },
      },
      blockers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            taskTitle: { type: "string" },
            reason: { type: "string" },
          },
          required: ["taskTitle", "reason"],
        },
      },
      suggestedNextActions: { type: "array", items: { type: "string" } },
    },
    required: [
      "missingTasks",
      "risks",
      "upcomingDeadlines",
      "blockers",
      "suggestedNextActions",
    ],
  },
};

export const nextActionsJsonSchema = {
  name: "submit_next_actions",
  description: "Submit 3-5 recommended next actions.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      actions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            taskId: { type: ["string", "null"] },
            taskTitle: { type: "string" },
            explanation: { type: "string" },
          },
          required: ["taskId", "taskTitle", "explanation"],
        },
      },
    },
    required: ["actions"],
  },
};

export const improveProjectJsonSchema = {
  name: "submit_improvement_suggestions",
  description: "Submit improvement suggestions for the project.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            type: {
              type: "string",
              enum: [
                "missing_workstream",
                "missing_task",
                "redundant_task",
                "reorder",
                "unrealistic_deadline",
                "missing_dependency",
              ],
            },
            title: { type: "string" },
            description: { type: "string" },
            targetTaskTitle: { type: ["string", "null"] },
          },
          required: ["id", "type", "title", "description", "targetTaskTitle"],
        },
      },
    },
    required: ["suggestions"],
  },
};
