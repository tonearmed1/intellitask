import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flag, ListTodo } from "lucide-react";
import type { TimelineEntry } from "@/services/dashboard";
import { dashboardService } from "@/services/dashboard";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { PriorityBadge } from "@/components/Badge";
import { formatDate } from "@/lib/dates";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";

function groupByMonth(entries: TimelineEntry[]): Map<string, TimelineEntry[]> {
  const groups = new Map<string, TimelineEntry[]>();
  for (const e of entries) {
    const key = formatDate(e.date, "MMMM yyyy");
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  return groups;
}

export default function TimelinePage() {
  const { show } = useToast();
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);

  useEffect(() => {
    dashboardService
      .timeline()
      .then((res) => setEntries(res.entries))
      .catch((err) => show(err instanceof ApiError ? err.message : "Couldn't load timeline.", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Timeline</h1>

      {entries === null ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          description="Tasks and milestones with a due date will appear here in chronological order."
        />
      ) : (
        <div className="space-y-8">
          {Array.from(groupByMonth(entries)).map(([month, items]) => (
            <div key={month}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {month}
              </h2>
              <ul className="space-y-1 rounded-xl border border-neutral-200 p-1 dark:border-neutral-800">
                {items.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link
                      to={`/projects/${item.projectId}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
                    >
                      <span className="w-16 shrink-0 text-xs text-neutral-400">
                        {formatDate(item.date, "d MMM")}
                      </span>
                      {item.kind === "milestone" ? (
                        <Flag className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      ) : (
                        <ListTodo className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm text-neutral-800 dark:text-neutral-100">
                        {item.title}
                      </span>
                      <span className="truncate text-xs text-neutral-400">{item.projectTitle}</span>
                      {item.priority && (
                        <PriorityBadge priority={item.priority as "low" | "medium" | "high" | "critical"} />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
