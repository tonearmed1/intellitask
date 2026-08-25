import type {
  AiExpandResult,
  AiImproveSuggestions,
  AiNextActions,
  AiProjectPlan,
  AiReview,
} from "@shared/ai-schema";
import type { ContextEntry, Task, TaskPriority } from "@shared/types";

export interface RelevantContextSnippet {
  title: string;
  content: string;
  category: string;
}

export interface SimilarProjectSnippet {
  title: string;
  workstreamTitles: string[];
  notableTaskTitles: string[];
}

export interface ResearchSnippet {
  title: string;
  url: string;
  extract: string;
}

export interface GenerateProjectInput {
  title: string;
  deadline: string | null;
  description: string | null;
  location: string | null;
  priority: TaskPriority;
  currentDate: string;
  relevantContext: RelevantContextSnippet[];
  similarProjects: SimilarProjectSnippet[];
  research: ResearchSnippet[];
  /** Set when refining an already-generated plan in response to answered questions. */
  existingSummary?: string;
  refinementNotes?: string;
}

export interface ExpandTaskInput {
  projectTitle: string;
  taskTitle: string;
  taskDescription: string | null;
  ancestorTitles: string[];
  siblingTitles: string[];
  currentDate: string;
  projectDeadline: string | null;
  relevantContext: RelevantContextSnippet[];
  deeper: boolean;
}

export interface ReviewProjectInput {
  projectTitle: string;
  deadline: string | null;
  currentDate: string;
  completedTaskTitles: string[];
  incompleteTaskTitles: string[];
  blockedTaskTitles: string[];
  relevantContext: RelevantContextSnippet[];
}

export interface SuggestNextActionsInput {
  projectTitle: string;
  deadline: string | null;
  currentDate: string;
  candidateTasks: Pick<
    Task,
    "id" | "title" | "priority" | "status" | "dueDate" | "estimatedEffort"
  >[];
  blockedTaskIds: Set<string>;
}

export interface ImproveProjectInput {
  projectTitle: string;
  deadline: string | null;
  currentDate: string;
  workstreamSummaries: { title: string; taskTitles: string[] }[];
}

export interface AiCallMeta {
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
}

export interface AiResult<T> {
  data: T;
  meta: AiCallMeta;
}

export interface AiCallOptions {
  /** Propagated from the incoming request so a client disconnect cancels the upstream call. */
  signal?: AbortSignal;
}

/** Shape of the hand-written JSON Schemas in json-schemas.ts, used for tool-use / structured output. */
export interface AICallToolSchema {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

/**
 * Every AI provider (mock, Anthropic, OpenAI, ...) implements this contract.
 * All methods must return data that already validates against the
 * corresponding zod schema in shared/ai-schema.ts — providers are
 * responsible for retrying the model on malformed output internally.
 */
export interface AIProvider {
  readonly name: string;
  generateProject(
    input: GenerateProjectInput,
    options?: AiCallOptions,
  ): Promise<AiResult<AiProjectPlan>>;
  expandTask(
    input: ExpandTaskInput,
    options?: AiCallOptions,
  ): Promise<AiResult<AiExpandResult>>;
  reviewProject(
    input: ReviewProjectInput,
    options?: AiCallOptions,
  ): Promise<AiResult<AiReview>>;
  suggestNextActions(
    input: SuggestNextActionsInput,
    options?: AiCallOptions,
  ): Promise<AiResult<AiNextActions>>;
  improveProject(
    input: ImproveProjectInput,
    options?: AiCallOptions,
  ): Promise<AiResult<AiImproveSuggestions>>;
}

export type { ContextEntry };
