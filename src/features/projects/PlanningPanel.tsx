import { useState } from "react";
import type { FormEvent } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Project } from "@shared/types";
import { projectsService } from "@/services/projects";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export function PlanningPanel({
  project,
  onChanged,
}: {
  project: Project;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(
    project.questions.some((q) => !q.answer) || project.assumptions.length > 0,
  );
  const { show } = useToast();
  const [answering, setAnswering] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");

  const hasAnything =
    project.assumptions.length > 0 ||
    project.questions.length > 0 ||
    project.risks.length > 0 ||
    project.missingInformation.length > 0;

  if (!hasAnything) return null;

  async function toggleAssumption(id: string, confirmed: boolean) {
    try {
      await projectsService.setAssumption(project.id, id, confirmed);
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't update assumption.", "error");
    }
  }

  async function submitAnswer(e: FormEvent, questionId: string) {
    e.preventDefault();
    if (!answerDraft.trim()) return;
    try {
      await projectsService.answerQuestion(project.id, questionId, answerDraft.trim());
      setAnswering(null);
      setAnswerDraft("");
      show("Answer saved.", "success");
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't save answer.", "error");
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
          Plan details
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-neutral-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-neutral-400" />
        )}
      </button>
      {open && (
        <div className="space-y-5 border-t border-neutral-200 px-4 py-4 dark:border-neutral-800">
          {project.questions.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Questions that could improve this plan
              </h3>
              <ul className="space-y-2">
                {project.questions.map((q) => (
                  <li key={q.id} className="text-sm">
                    <p className="text-neutral-700 dark:text-neutral-300">{q.question}</p>
                    {q.answer ? (
                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                        Answered: {q.answer}
                      </p>
                    ) : answering === q.id ? (
                      <form
                        onSubmit={(e) => submitAnswer(e, q.id)}
                        className="mt-1 flex items-center gap-2"
                      >
                        <Input
                          autoFocus
                          value={answerDraft}
                          onChange={(e) => setAnswerDraft(e.target.value)}
                          className="py-1 text-xs"
                        />
                        <Button type="submit" size="sm">
                          Save
                        </Button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAnswering(q.id);
                          setAnswerDraft("");
                        }}
                        className="mt-0.5 text-xs font-medium text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-400"
                      >
                        Answer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {project.assumptions.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Assumptions
              </h3>
              <ul className="space-y-1.5">
                {project.assumptions.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={a.confirmed}
                      onChange={(e) => toggleAssumption(a.id, e.target.checked)}
                      className="mt-1"
                      aria-label={`Confirm assumption: ${a.text}`}
                    />
                    <span
                      className={
                        a.confirmed
                          ? "text-neutral-500 dark:text-neutral-400"
                          : "text-neutral-700 dark:text-neutral-300"
                      }
                    >
                      {a.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {project.risks.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Risks
              </h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
                {project.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {project.missingInformation.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Missing information
              </h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
                {project.missingInformation.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
