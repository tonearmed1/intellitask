import { api, type RequestOptions } from "@/lib/api";
import type {
  AiImproveSuggestions,
  AiNextActions,
  AiReview,
} from "@shared/ai-schema";
import type {
  Milestone,
  Project,
  ProjectWithStats,
  TaskPriority,
  TaskWithChildren,
} from "@shared/types";

export interface ProjectDetail {
  project: Project;
  tree: TaskWithChildren[];
  milestones: Milestone[];
}

export interface CreateProjectInput {
  mode: "quick" | "ai";
  title: string;
  deadline?: string | null;
  description?: string | null;
  location?: string | null;
  priority?: TaskPriority;
  notes?: string | null;
}

export const projectsService = {
  list: () => api.get<{ projects: ProjectWithStats[] }>("/api/projects"),
  create: (input: CreateProjectInput, options?: RequestOptions) =>
    api.post<ProjectDetail>("/api/projects", input, options),
  get: (id: string) => api.get<ProjectDetail>(`/api/projects/${id}`),
  update: (
    id: string,
    patch: Partial<{
      title: string;
      description: string | null;
      deadline: string | null;
      location: string | null;
      priority: TaskPriority;
      notes: string | null;
      status: Project["status"];
    }>,
  ) => api.patch<{ project: Project }>(`/api/projects/${id}`, patch),
  remove: (id: string) => api.delete<{ ok: true }>(`/api/projects/${id}`),
  answerQuestion: (id: string, questionId: string, answer: string) =>
    api.post<{ project: Project }>(`/api/projects/${id}/questions/${questionId}/answer`, {
      answer,
    }),
  setAssumption: (id: string, assumptionId: string, confirmed: boolean, text?: string) =>
    api.post<{ project: Project }>(`/api/projects/${id}/assumptions/${assumptionId}`, {
      confirmed,
      text,
    }),
  review: (id: string, options?: RequestOptions) =>
    api.post<{ review: AiReview }>(`/api/projects/${id}/review`, undefined, options),
  applyReviewTask: (
    id: string,
    input: { title: string; reason: string; suggestedWorkstream: string | null; priority: TaskPriority },
  ) => api.post<ProjectDetail>(`/api/projects/${id}/review/apply-task`, input),
  nextActions: (id: string, options?: RequestOptions) =>
    api.post<AiNextActions>(`/api/projects/${id}/next-actions`, undefined, options),
  improve: (id: string, options?: RequestOptions) =>
    api.post<AiImproveSuggestions>(`/api/projects/${id}/improve`, undefined, options),
  applyImprove: (id: string, title: string, description: string) =>
    api.post<ProjectDetail>(`/api/projects/${id}/improve/apply`, {
      type: "missing_task",
      title,
      description,
    }),
};
