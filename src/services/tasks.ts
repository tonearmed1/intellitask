import { api, type RequestOptions } from "@/lib/api";
import type { ItemState, Task, TaskPriority, TaskStatus, TaskType } from "@shared/types";
import type { ProjectDetail } from "./projects";

export interface CreateTaskInput {
  projectId: string;
  parentTaskId?: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedEffort?: string | null;
  notes?: string | null;
  taskType?: TaskType;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedEffort?: string | null;
  notes?: string | null;
  itemState?: ItemState | null;
  tags?: string[];
}

export const tasksService = {
  create: (input: CreateTaskInput) => api.post<{ task: Task }>("/api/tasks", input),
  update: (id: string, patch: UpdateTaskInput) =>
    api.patch<{ task: Task }>(`/api/tasks/${id}`, patch),
  remove: (id: string) => api.delete<{ ok: true }>(`/api/tasks/${id}`),
  duplicate: (id: string) => api.post<{ task: Task }>(`/api/tasks/${id}/duplicate`),
  move: (id: string, parentTaskId: string | null, index: number) =>
    api.post<{ task: Task }>(`/api/tasks/${id}/move`, { parentTaskId, index }),
  reorder: (projectId: string, parentTaskId: string | null, orderedTaskIds: string[]) =>
    api.post<{ ok: true }>("/api/tasks/reorder", { projectId, parentTaskId, orderedTaskIds }),
  expand: (id: string, deeper: boolean, options?: RequestOptions) =>
    api.post<ProjectDetail>(`/api/tasks/${id}/expand${deeper ? "?deeper=true" : ""}`, undefined, options),
};
