import { useState } from "react";
import { AlertTriangle, CalendarClock, ClipboardList, Compass, Sparkles, Wand2 } from "lucide-react";
import type { AiImproveSuggestions, AiNextActions, AiReview } from "@shared/ai-schema";
import { projectsService } from "@/services/projects";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";

type PanelKind = "review" | "next-actions" | "improve" | null;

export function AiActionsPanel({
  projectId,
  onChanged,
}: {
  projectId: string;
  onChanged: () => void;
}) {
  const { show } = useToast();
  const [active, setActive] = useState<PanelKind>(null);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<AiReview | null>(null);
  const [nextActions, setNextActions] = useState<AiNextActions | null>(null);
  const [improve, setImprove] = useState<AiImproveSuggestions | null>(null);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);

  async function run(kind: PanelKind) {
    setActive(kind);
    setLoading(true);
    try {
      if (kind === "review") {
        const res = await projectsService.review(projectId);
        setReview(res.review);
      } else if (kind === "next-actions") {
        const res = await projectsService.nextActions(projectId);
        setNextActions(res);
      } else if (kind === "improve") {
        const res = await projectsService.improve(projectId);
        setImprove(res);
      }
    } catch (err) {
      show(
        err instanceof ApiError ? err.message : "That AI action failed. Please try again.",
        "error",
      );
      setActive(null);
    } finally {
      setLoading(false);
    }
  }

  async function applyMissingTask(item: {
    title: string;
    reason: string;
    suggestedWorkstream: string | null;
    priority: "low" | "medium" | "high" | "critical";
  }) {
    setApplyingKey(item.title);
    try {
      await projectsService.applyReviewTask(projectId, item);
      show(`Added "${item.title}".`, "success");
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't add task.", "error");
    } finally {
      setApplyingKey(null);
    }
  }

  async function applyImproveTask(title: string, description: string) {
    setApplyingKey(title);
    try {
      await projectsService.applyImprove(projectId, title, description);
      show(`Added "${title}".`, "success");
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't add task.", "error");
    } finally {
      setApplyingKey(null);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        AI assistant
      </h3>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => run("review")} disabled={loading}>
          <ClipboardList className="h-3.5 w-3.5" /> Review Project
        </Button>
        <Button size="sm" variant="secondary" onClick={() => run("next-actions")} disabled={loading}>
          <Compass className="h-3.5 w-3.5" /> What should I do next?
        </Button>
        <Button size="sm" variant="secondary" onClick={() => run("improve")} disabled={loading}>
          <Wand2 className="h-3.5 w-3.5" /> Improve this project
        </Button>
      </div>

      {loading && (
        <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
          <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-500" /> Thinking…
        </p>
      )}

      {!loading && active === "review" && review && (
        <div className="mt-4 space-y-4 text-sm">
          {review.missingTasks.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-neutral-500">Missing tasks</p>
              <ul className="space-y-1.5">
                {review.missingTasks.map((t) => (
                  <li
                    key={t.title}
                    className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-800 dark:text-neutral-100">
                        {t.title}
                      </p>
                      <p className="truncate text-xs text-neutral-500">{t.reason}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={applyingKey === t.title}
                      onClick={() => applyMissingTask(t)}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {review.risks.length > 0 && (
            <InfoList icon={AlertTriangle} label="Risks" items={review.risks} />
          )}
          {review.blockers.length > 0 && (
            <InfoList
              icon={AlertTriangle}
              label="Blockers"
              items={review.blockers.map((b) => `${b.taskTitle} — ${b.reason}`)}
            />
          )}
          {review.upcomingDeadlines.length > 0 && (
            <InfoList
              icon={CalendarClock}
              label="Upcoming deadlines"
              items={review.upcomingDeadlines.map((d) => `${d.taskTitle} — ${d.dueDate}`)}
            />
          )}
          {review.suggestedNextActions.length > 0 && (
            <InfoList icon={Compass} label="Suggested next actions" items={review.suggestedNextActions} />
          )}
        </div>
      )}

      {!loading && active === "next-actions" && nextActions && (
        <ul className="mt-4 space-y-2 text-sm">
          {nextActions.actions.length === 0 && (
            <p className="text-xs text-neutral-400">No open tasks to recommend right now.</p>
          )}
          {nextActions.actions.map((a, i) => (
            <li key={i} className="rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60">
              <p className="font-medium text-neutral-800 dark:text-neutral-100">{a.taskTitle}</p>
              <p className="text-xs text-neutral-500">{a.explanation}</p>
            </li>
          ))}
        </ul>
      )}

      {!loading && active === "improve" && improve && (
        <ul className="mt-4 space-y-2 text-sm">
          {improve.suggestions.length === 0 && (
            <p className="text-xs text-neutral-400">No suggestions — this project looks solid.</p>
          )}
          {improve.suggestions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-800 dark:text-neutral-100">
                  {s.title}
                  <span className="ml-2 text-[10px] font-normal uppercase text-neutral-400">
                    {s.type.replace(/_/g, " ")}
                  </span>
                </p>
                <p className="truncate text-xs text-neutral-500">{s.description}</p>
              </div>
              {s.type === "missing_task" && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={applyingKey === s.title}
                  onClick={() => applyImproveTask(s.title, s.description)}
                >
                  Add
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InfoList({
  icon: Icon,
  label,
  items,
}: {
  icon: typeof AlertTriangle;
  label: string;
  items: string[];
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <ul className="list-inside list-disc space-y-1 text-neutral-700 dark:text-neutral-300">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
