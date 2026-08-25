import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { ContextCategory, ContextEntry } from "@shared/types";
import { CONTEXT_CATEGORIES } from "@shared/types";
import { contextService } from "@/services/context";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { Input, Label, Select, Textarea } from "@/components/Input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";

const CATEGORY_LABEL: Record<ContextCategory, string> = {
  personal: "Personal",
  company: "Company",
  people: "People",
  products: "Products",
  locations: "Locations",
  suppliers: "Suppliers",
  equipment: "Equipment",
  preferences: "Preferences",
  processes: "Processes",
  other: "Other",
};

function EntryForm({
  initial,
  onCancel,
  onSubmit,
  submitting,
}: {
  initial?: Partial<ContextEntry>;
  onCancel: () => void;
  onSubmit: (data: { category: ContextCategory; title: string; content: string }) => void;
  submitting: boolean;
}) {
  const [category, setCategory] = useState<ContextCategory>(initial?.category ?? "other");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSubmit({ category, title: title.trim(), content: content.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="ctx-category">Category</Label>
        <Select
          id="ctx-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ContextCategory)}
        >
          {CONTEXT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="ctx-title">Title</Label>
        <Input
          id="ctx-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Company"
          required
          maxLength={200}
        />
      </div>
      <div>
        <Label htmlFor="ctx-content">Details</Label>
        <Textarea
          id="ctx-content"
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="e.g. GR1T Motorcycles — CEO, based in Brno. Products: G1S, G1X, G1XR."
          required
        />
      </div>
      <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export default function ContextPage() {
  const { show } = useToast();
  const [entries, setEntries] = useState<ContextEntry[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ContextEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<ContextEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await contextService.list();
      setEntries(res.entries);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't load context.", "error");
    }
  }, [show]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(data: { category: ContextCategory; title: string; content: string }) {
    setSubmitting(true);
    try {
      await contextService.create(data);
      show("Context entry saved.", "success");
      setCreating(false);
      load();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't save entry.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(data: { category: ContextCategory; title: string; content: string }) {
    if (!editingEntry) return;
    setSubmitting(true);
    try {
      await contextService.update(editingEntry.id, data);
      show("Context entry updated.", "success");
      setEditingEntry(null);
      load();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't update entry.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingEntry) return;
    setSubmitting(true);
    try {
      await contextService.remove(deletingEntry.id);
      show("Context entry deleted.", "success");
      setDeletingEntry(null);
      load();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't delete entry.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = new Map<ContextCategory, ContextEntry[]>();
  for (const e of entries ?? []) {
    const list = grouped.get(e.category) ?? [];
    list.push(e);
    grouped.set(e.category, list);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Context</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Company, people, products, and preferences the AI can draw on when planning.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Add entry
        </Button>
      </div>

      {entries === null ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No context yet"
          description="Add facts about your company, team, products, or preferences so future plans are more relevant."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Add your first entry
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {Array.from(grouped).map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {CATEGORY_LABEL[category]}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map((entry) => (
                  <div
                    key={entry.id}
                    className="group rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                        {entry.title}
                      </p>
                      <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setEditingEntry(entry)}
                          aria-label={`Edit ${entry.title}`}
                        >
                          <Pencil className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-700" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingEntry(entry)}
                          aria-label={`Delete ${entry.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-neutral-400 hover:text-red-600" />
                        </button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-xs text-neutral-500 dark:text-neutral-400">
                      {entry.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <Modal open onClose={() => setCreating(false)} title="Add context entry">
          <EntryForm onCancel={() => setCreating(false)} onSubmit={handleCreate} submitting={submitting} />
        </Modal>
      )}

      {editingEntry && (
        <Modal open onClose={() => setEditingEntry(null)} title="Edit context entry">
          <EntryForm
            initial={editingEntry}
            onCancel={() => setEditingEntry(null)}
            onSubmit={handleUpdate}
            submitting={submitting}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={deletingEntry !== null}
        title="Delete context entry"
        message={`Delete "${deletingEntry?.title}"? This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeletingEntry(null)}
        loading={submitting}
      />
    </div>
  );
}
