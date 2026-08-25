import { api } from "@/lib/api";
import type { Milestone } from "@shared/types";

export const milestonesService = {
  create: (input: { projectId: string; title: string; description?: string | null; dueDate?: string | null }) =>
    api.post<{ milestone: Milestone }>("/api/milestones", input),
  update: (
    id: string,
    patch: Partial<{ title: string; description: string | null; dueDate: string | null; completed: boolean }>,
  ) => api.patch<{ milestone: Milestone }>(`/api/milestones/${id}`, patch),
  remove: (id: string) => api.delete<{ ok: true }>(`/api/milestones/${id}`),
};
