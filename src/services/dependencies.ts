import { api } from "@/lib/api";
import type { TaskDependency } from "@shared/types";

export const dependenciesService = {
  create: (taskId: string, dependsOnTaskId: string) =>
    api.post<{ dependency: TaskDependency }>("/api/dependencies", { taskId, dependsOnTaskId }),
  remove: (id: string) => api.delete<{ ok: true }>(`/api/dependencies/${id}`),
};
