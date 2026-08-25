import { api } from "@/lib/api";
import type { InboxItem, InboxItemStatus } from "@shared/types";

export const inboxService = {
  list: (status?: InboxItemStatus) =>
    api.get<{ items: InboxItem[] }>(`/api/inbox${status ? `?status=${status}` : ""}`),
  create: (content: string) => api.post<{ item: InboxItem }>("/api/inbox", { content }),
  resolve: (id: string, targetProjectId: string, targetParentTaskId: string | null) =>
    api.post<{ ok: true }>(`/api/inbox/${id}/resolve`, { targetProjectId, targetParentTaskId }),
  dismiss: (id: string) => api.post<{ ok: true }>(`/api/inbox/${id}/dismiss`),
};
