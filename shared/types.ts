// Domain types shared between the Worker API and the React client.
// Kept dependency-free (no zod) so it is cheap to import anywhere.

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "waiting"
  | "blocked"
  | "done"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "critical";

/** Distinguishes who/what created a record, used to gate AI write permissions. */
export type Source = "user" | "ai_generated" | "ai_suggested";

export type TaskType = "task" | "item";

export type ItemState = "need" | "ordered" | "ready" | "packed";

export type ProjectStatus = "active" | "completed" | "archived";

export type ContextCategory =
  | "personal"
  | "company"
  | "people"
  | "products"
  | "locations"
  | "suppliers"
  | "equipment"
  | "preferences"
  | "processes"
  | "other";

export type InboxItemStatus = "pending" | "resolved" | "dismissed";

export type AiOperation =
  | "generateProject"
  | "expandTask"
  | "reviewProject"
  | "suggestNextActions"
  | "improveProject"
  | "refineProject";

export type AiProviderName = "mock" | "anthropic" | "openai";

export interface Task {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  startDate: string | null;
  estimatedEffort: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  source: Source;
  aiGenerated: boolean;
  researchSupported: boolean;
  sortOrder: number;
  taskType: TaskType;
  itemState: ItemState | null;
  tags: string[];
  reason: string | null;
  requiresResearch: boolean;
}

export interface TaskWithChildren extends Task {
  children: TaskWithChildren[];
  dependsOn: string[];
  blockedByIncomplete: boolean;
}

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  createdAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
  source: Source;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  location: string | null;
  priority: TaskPriority;
  notes: string | null;
  status: ProjectStatus;
  isQuickTask: boolean;
  projectSummary: string | null;
  assumptions: Assumption[];
  questions: PlanQuestion[];
  risks: string[];
  missingInformation: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Assumption {
  id: string;
  text: string;
  confirmed: boolean;
}

export interface PlanQuestion {
  id: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
}

export interface ProjectWithStats extends Project {
  taskCount: number;
  completedCount: number;
  overdueCount: number;
  nextMilestone: Milestone | null;
}

export interface ContextEntry {
  id: string;
  category: ContextCategory;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ResearchSource {
  id: string;
  query: string;
  sourceUrl: string;
  title: string;
  extract: string;
  researchedAt: string;
  providerName: string;
}

export interface ProjectResearchLink {
  id: string;
  projectId: string;
  researchSourceId: string;
  taskId: string | null;
  createdAt: string;
}

export interface InboxItem {
  id: string;
  content: string;
  status: InboxItemStatus;
  suggestedProjectId: string | null;
  suggestedParentTaskId: string | null;
  suggestionReason: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AppSettings {
  aiProvider: AiProviderName;
  aiModel: string;
  allowWebResearch: boolean;
  theme: "light" | "dark" | "system";
}

export interface AiRun {
  id: string;
  operation: AiOperation;
  provider: string;
  model: string;
  projectId: string | null;
  taskId: string | null;
  success: boolean;
  errorMessage: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
  createdAt: string;
}

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "waiting",
  "blocked",
  "done",
  "cancelled",
];

export const TASK_PRIORITIES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const CONTEXT_CATEGORIES: ContextCategory[] = [
  "personal",
  "company",
  "people",
  "products",
  "locations",
  "suppliers",
  "equipment",
  "preferences",
  "processes",
  "other",
];
