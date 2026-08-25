import { api } from "@/lib/api";
import type { ContextCategory, ContextEntry } from "@shared/types";

export const contextService = {
  list: () => api.get<{ entries: ContextEntry[] }>("/api/context"),
  create: (input: { category: ContextCategory; title: string; content: string; tags?: string[] }) =>
    api.post<{ entry: ContextEntry }>("/api/context", input),
  update: (
    id: string,
    patch: Partial<{ category: ContextCategory; title: string; content: string; tags: string[] }>,
  ) => api.patch<{ entry: ContextEntry }>(`/api/context/${id}`, patch),
  remove: (id: string) => api.delete<{ ok: true }>(`/api/context/${id}`),
};
