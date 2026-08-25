import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import type { TodayTask, TodayView } from "@/services/dashboard";
import { dashboardService } from "@/services/dashboard";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { PriorityBadge, StatusBadge } from "@/components/Badge";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { relativeDueLabel, todayIso } from "@/lib/dates";
import { tasksService } from "@/services/tasks";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";

function TaskLine({ task, onDone }: { task: TodayTask; onDone: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
      <button
        type="button"
        onClick={onDone}
        aria-label="Mark done"
        className="h-4 w-4 shrink-0 rounded-full border border-neutral-300 dark:border-neutral-600"
      />
      <Link to={`/projects/${task.projectId}`} className="min-w-0 flex-1">
        <p className="truncate text-sm text-neutral-800 dark:text-neutral-100">{task.title}</p>
        <p className="truncate text-xs text-neutral-400">{task.projectTitle}</p>
      </Link>
      <PriorityBadge priority={task.priority} />
      {task.status !== "todo" && <StatusBadge status={task.status} />}
      {task.dueDate && (
        <span className="whitespace-nowrap text-xs text-neutral-400">
          {relativeDueLabel(task.dueDate)}
        </span>
      )}
    </li>
  );
}

function Section({
  title,
  tasks,
  onDone,
  emptyText,
  highlight,
}: {
  title: string;
  tasks: TodayTask[];
  onDone: (id: string) => void;
  emptyText?: string;
  highlight?: boolean;
}) {
  if (tasks.length === 0 && !emptyText) return null;
  return (
    <section className="mb-6">
      <h2
        className={cn(
          "mb-2 text-xs font-semibold uppercase tracking-wide",
          highlight ? "text-red-500" : "text-neutral-400",
        )}
      >
        {title} {tasks.length > 0 && <span>({tasks.length})</span>}
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-neutral-400">{emptyText}</p>
      ) : (
        <ul className="space-y-0.5 rounded-xl border border-neutral-200 p-1 dark:border-neutral-800">
          {tasks.map((t) => (
            <TaskLine key={t.id} task={t} onDone={() => onDone(t.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function TodayPage() {
  const { show } = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState<TodayView | null>(null);
  const [quickTitle, setQuickTitle] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await dashboardService.today(todayIso());
      setView(res);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't load Today.", "error");
    }
  }, [show]);

  useEffect(() => {
    load();
  }, [load]);

  async function markDone(taskId: string) {
    try {
      await tasksService.update(taskId, { status: "done" });
      load();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't update task.", "error");
    }
  }

  function handleQuickEntry(e: FormEvent) {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    navigate(`/projects?new=ai&title=${encodeURIComponent(quickTitle.trim())}`);
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Today</h1>

      <form
        onSubmit={handleQuickEntry}
        className="mb-8 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <Sparkles className="ml-2 h-4 w-4 text-neutral-400" />
        <Input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="What do you want to get done?"
          className="border-0 shadow-none focus:ring-0"
        />
        <Button type="submit" variant="primary" disabled={!quickTitle.trim()}>
          Build Plan
        </Button>
      </form>

      {view === null ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : view.overdue.length +
          view.dueToday.length +
          view.recommended.length +
          view.blocked.length +
          view.waiting.length ===
        0 ? (
        <EmptyState
          title="Nothing on your plate today"
          description="Create a project above or check Projects to see what's next."
        />
      ) : (
        <>
          <Section title="Overdue" tasks={view.overdue} onDone={markDone} highlight />
          <Section title="Due today" tasks={view.dueToday} onDone={markDone} />
          <Section title="Recommended" tasks={view.recommended} onDone={markDone} />
          <Section title="Blocked" tasks={view.blocked} onDone={markDone} />
          <Section title="Waiting" tasks={view.waiting} onDone={markDone} />
        </>
      )}
    </div>
  );
}
