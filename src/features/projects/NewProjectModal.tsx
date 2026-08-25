import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { TaskPriority } from "@shared/types";
import { TASK_PRIORITIES } from "@shared/types";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input, Label, Select, Textarea } from "@/components/Input";
import { priorityLabel } from "@/components/Badge";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { projectsService } from "@/services/projects";
import { useAiStages, PROJECT_GENERATION_STAGES } from "@/features/ai/useAiStages";

interface NewProjectModalProps {
  mode: "quick" | "ai";
  initialTitle?: string;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

export function NewProjectModal({ mode, initialTitle, onClose, onCreated }: NewProjectModalProps) {
  const { show } = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [notes, setNotes] = useState("");
  const [showOptional, setShowOptional] = useState(Boolean(initialTitle));
  const [submitting, setSubmitting] = useState(false);
  const [controller, setController] = useState<AbortController | null>(null);
  const stageLabel = useAiStages(PROJECT_GENERATION_STAGES, submitting && mode === "ai");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    const ac = new AbortController();
    setController(ac);
    try {
      const detail = await projectsService.create(
        {
          mode,
          title: title.trim(),
          deadline: deadline || null,
          description: description || null,
          location: location || null,
          priority,
          notes: notes || null,
        },
        { signal: ac.signal },
      );
      show(mode === "ai" ? "Plan generated." : "Task created.", "success");
      onCreated(detail.project.id);
      navigate(`/projects/${detail.project.id}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      show(
        err instanceof ApiError ? err.message : "Something went wrong building this project.",
        "error",
      );
    } finally {
      setSubmitting(false);
      setController(null);
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        controller?.abort();
        onClose();
      }}
      title={mode === "ai" ? "New AI project" : "New quick task"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="new-title">
            {mode === "ai" ? "What do you want to get done?" : "Task"}
          </Label>
          <Input
            id="new-title"
            autoFocus
            placeholder={mode === "ai" ? "e.g. Prepare for EICMA" : "e.g. Call Marco"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </div>

        {!showOptional && (
          <button
            type="button"
            onClick={() => setShowOptional(true)}
            className="text-xs font-medium text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-400"
          >
            + Add deadline, description, location…
          </button>
        )}

        {showOptional && (
          <div className="space-y-4 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-deadline">Deadline</Label>
                <Input
                  id="new-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="new-priority">Priority</Label>
                <Select
                  id="new-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {priorityLabel[p]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {mode === "ai" && (
              <>
                <div>
                  <Label htmlFor="new-description">Description / context</Label>
                  <Textarea
                    id="new-description"
                    rows={3}
                    placeholder="Anything the planner should know — scope, constraints, team size…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="new-location">Location</Label>
                  <Input
                    id="new-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="new-notes">Notes</Label>
              <Textarea
                id="new-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {submitting && mode === "ai" && (
          <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
            {stageLabel}…
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              controller?.abort();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || !title.trim()}>
            {submitting ? "Working…" : mode === "ai" ? "Build Plan" : "Create task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
