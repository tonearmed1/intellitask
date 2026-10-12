import { pgSchema, text, integer, boolean, jsonb } from "drizzle-orm/pg-core";

/**
 * Everything lives in its own Postgres schema rather than `public`. The
 * Neon database this deploys against is shared with other apps (a Prisma
 * app's `migrate`/`db push` once wiped our `public` tables), so a dedicated
 * schema keeps Intellitask's data isolated from anything operating on
 * `public`.
 */
export const intellitask = pgSchema("intellitask");

export const users = intellitask.table("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = intellitask.table("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const settings = intellitask.table("settings", {
  id: integer("id").primaryKey(),
  aiProvider: text("ai_provider").notNull(),
  aiModel: text("ai_model").notNull(),
  allowWebResearch: boolean("allow_web_research").notNull(),
  theme: text("theme").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const projects = intellitask.table("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  deadline: text("deadline"),
  location: text("location"),
  priority: text("priority").notNull(),
  notes: text("notes"),
  status: text("status").notNull(),
  isQuickTask: boolean("is_quick_task").notNull(),
  projectSummary: text("project_summary"),
  assumptions: jsonb("assumptions").notNull().$type<unknown[]>(),
  questions: jsonb("questions").notNull().$type<unknown[]>(),
  risks: jsonb("risks").notNull().$type<string[]>(),
  missingInformation: jsonb("missing_information").notNull().$type<string[]>(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tasks = intellitask.table("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  parentTaskId: text("parent_task_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  dueDate: text("due_date"),
  startDate: text("start_date"),
  estimatedEffort: text("estimated_effort"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
  source: text("source").notNull(),
  aiGenerated: boolean("ai_generated").notNull(),
  researchSupported: boolean("research_supported").notNull(),
  sortOrder: integer("sort_order").notNull(),
  taskType: text("task_type").notNull(),
  itemState: text("item_state"),
  tags: jsonb("tags").notNull().$type<string[]>(),
  reason: text("reason"),
  requiresResearch: boolean("requires_research").notNull(),
});

export const taskDependencies = intellitask.table("task_dependencies", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  dependsOnTaskId: text("depends_on_task_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const milestones = intellitask.table("milestones", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  completed: boolean("completed").notNull(),
  source: text("source").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const contextEntries = intellitask.table("context_entries", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: jsonb("tags").notNull().$type<string[]>(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const researchSources = intellitask.table("research_sources", {
  id: text("id").primaryKey(),
  query: text("query").notNull(),
  sourceUrl: text("source_url").notNull(),
  title: text("title").notNull(),
  extract: text("extract").notNull(),
  researchedAt: text("researched_at").notNull(),
  providerName: text("provider_name").notNull(),
});

export const projectResearch = intellitask.table("project_research", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  researchSourceId: text("research_source_id").notNull(),
  taskId: text("task_id"),
  createdAt: text("created_at").notNull(),
});

export const aiRuns = intellitask.table("ai_runs", {
  id: text("id").primaryKey(),
  operation: text("operation").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  projectId: text("project_id"),
  taskId: text("task_id"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  durationMs: integer("duration_ms").notNull(),
  createdAt: text("created_at").notNull(),
});

export const inboxItems = intellitask.table("inbox_items", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  status: text("status").notNull(),
  suggestedProjectId: text("suggested_project_id"),
  suggestedParentTaskId: text("suggested_parent_task_id"),
  suggestionReason: text("suggestion_reason"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});
