import { api } from "@/lib/api";
import type { Project, TaskWithChildren } from "@shared/types";

export type TodayTask = TaskWithChildren & { projectTitle: string; projectId: string };

export interface TodayView {
  overdue: TodayTask[];
  dueToday: TodayTask[];
  recommended: TodayTask[];
  blocked: TodayTask[];
  waiting: TodayTask[];
}

export interface TimelineEntry {
  kind: "task" | "milestone";
  id: string;
  title: string;
  date: string;
  projectId: string;
  projectTitle: string;
  priority?: string;
  completed?: boolean;
}

export const dashboardService = {
  today: (date?: string) => api.get<TodayView>(`/api/today${date ? `?date=${date}` : ""}`),
  timeline: (date?: string) =>
    api.get<{ entries: TimelineEntry[] }>(`/api/timeline${date ? `?date=${date}` : ""}`),
  recentProjects: () => api.get<{ projects: Project[] }>("/api/recent-projects"),
};
