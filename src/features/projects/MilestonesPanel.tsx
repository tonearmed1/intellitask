import { useState } from "react";
import type { FormEvent } from "react";
import { Flag, Plus, Trash2 } from "lucide-react";
import type { Milestone } from "@shared/types";
import { milestonesService } from "@/services/milestones";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";

export function MilestonesPanel({
  projectId,
  milestones,
  onChanged,
}: {
  projectId: string;
  milestones: Milestone[];
  onChanged: () => void;
}) {
  const { show } = useToast();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function toggle(m: Milestone) {
    try {
      await milestonesService.update(m.id, { completed: !m.completed });
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't update milestone.", "error");
    }
  }

  async function remove(id: string) {
    try {
      await milestonesService.remove(id);
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't delete milestone.", "error");
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await milestonesService.create({ projectId, title: title.trim(), dueDate: dueDate || null });
      setTitle("");
      setDueDate("");
      setAdding(false);
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't add milestone.", "error");
    }
  }

  if (milestones.length === 0 && !adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        <Plus className="h-3.5 w-3.5" /> Add milestone
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Milestones
      </h3>
      <ul className="space-y-2">
        {milestones.map((m) => (
          <li key={m.id} className="group flex items-center gap-2 text-sm">
            <button
              type="button"
              role="checkbox"
              aria-checked={m.completed}
              onClick={() => toggle(m)}
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                m.completed
                  ? "border-green-500 bg-green-500 text-white"
                  : "border-neutral-300 dark:border-neutral-600",
              )}
            >
              {m.completed && <span className="text-[10px] leading-none">✓</span>}
            </button>
            <Flag className="h-3.5 w-3.5 text-neutral-400" />
            <span
              className={cn(
                "flex-1",
                m.completed && "text-neutral-400 line-through dark:text-neutral-500",
              )}
            >
              {m.title}
            </span>
            {m.dueDate && (
              <span className="text-xs text-neutral-400">{formatDate(m.dueDate)}</span>
            )}
            <button
              type="button"
              onClick={() => remove(m.id)}
              aria-label={`Delete milestone ${m.title}`}
              className="opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5 text-neutral-400 hover:text-red-600" />
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <form onSubmit={handleAdd} className="mt-3 flex items-center gap-2">
          <Input
            autoFocus
            placeholder="Milestone title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 py-1.5 text-sm"
          />
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-36 py-1.5 text-sm"
          />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          <Plus className="h-3.5 w-3.5" /> Add milestone
        </button>
      )}
    </div>
  );
}
