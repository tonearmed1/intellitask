import {
  sqliteTable,
  text,
  integer,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  aiProvider: text("ai_provider").notNull(),
  aiModel: text("ai_model").notNull(),
  allowWebResearch: integer("allow_web_research", { mode: "boolean" }).notNull(),
  theme: text("theme").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  deadline: text("deadline"),
  location: text("location"),
  priority: text("priority").notNull(),
  notes: text("notes"),
  status: text("status").notNull(),
  isQuickTask: integer("is_quick_task", { mode: "boolean" }).notNull(),
  projectSummary: text("project_summary"),
  assumptions: text("assumptions").notNull(),
  questions: text("questions").notNull(),
  risks: text("risks").notNull(),
  missingInformation: text("missing_information").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tasks = sqliteTable("tasks", {
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
  aiGenerated: integer("ai_generated", { mode: "boolean" }).notNull(),
  researchSupported: integer("research_supported", { mode: "boolean" }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  taskType: text("task_type").notNull(),
  itemState: text("item_state"),
  tags: text("tags").notNull(),
  reason: text("reason"),
  requiresResearch: integer("requires_research", { mode: "boolean" }).notNull(),
});

export const taskDependencies = sqliteTable("task_dependencies", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  dependsOnTaskId: text("depends_on_task_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const milestones = sqliteTable("milestones", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  completed: integer("completed", { mode: "boolean" }).notNull(),
  source: text("source").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const contextEntries = sqliteTable("context_entries", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: text("tags").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const researchSources = sqliteTable("research_sources", {
  id: text("id").primaryKey(),
  query: text("query").notNull(),
  sourceUrl: text("source_url").notNull(),
  title: text("title").notNull(),
  extract: text("extract").notNull(),
  researchedAt: text("researched_at").notNull(),
  providerName: text("provider_name").notNull(),
});

export const projectResearch = sqliteTable("project_research", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  researchSourceId: text("research_source_id").notNull(),
  taskId: text("task_id"),
  createdAt: text("created_at").notNull(),
});

export const aiRuns = sqliteTable("ai_runs", {
  id: text("id").primaryKey(),
  operation: text("operation").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  projectId: text("project_id"),
  taskId: text("task_id"),
  success: integer("success", { mode: "boolean" }).notNull(),
  errorMessage: text("error_message"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  durationMs: integer("duration_ms").notNull(),
  createdAt: text("created_at").notNull(),
});

export const inboxItems = sqliteTable("inbox_items", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  status: text("status").notNull(),
  suggestedProjectId: text("suggested_project_id"),
  suggestedParentTaskId: text("suggested_parent_task_id"),
  suggestionReason: text("suggestion_reason"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});
