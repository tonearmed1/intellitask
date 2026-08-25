import { api } from "@/lib/api";
import type { ContextEntry, Project, Task } from "@shared/types";

export interface SearchResults {
  projects: Project[];
  tasks: (Task & { projectTitle: string })[];
  contextEntries: ContextEntry[];
}

export const searchService = {
  search: (query: string) => api.get<SearchResults>(`/api/search?q=${encodeURIComponent(query)}`),
};
