import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { InboxItem } from "@shared/types";
import { inboxService } from "@/services/inbox";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";

function InboxRow({ item, onResolved }: { item: InboxItem; onResolved: () => void }) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  async function accept() {
    if (!item.suggestedProjectId) return;
    setBusy(true);
    try {
      await inboxService.resolve(item.id, item.suggestedProjectId, item.suggestedParentTaskId);
      show("Added to project.", "success");
      onResolved();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't move item.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    setBusy(true);
    try {
      await inboxService.dismiss(item.id);
      onResolved();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't dismiss item.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-sm text-neutral-800 dark:text-neutral-100">{item.content}</p>
      {item.suggestionReason && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Suggestion: {item.suggestionReason}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        {item.suggestedProjectId && (
          <Button size="sm" variant="secondary" onClick={accept} disabled={busy}>
            Accept suggestion
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy}>
          Dismiss
        </Button>
      </div>
    </li>
  );
}

export default function InboxPage() {
  const { show } = useToast();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await inboxService.list("pending");
      setItems(res.items);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't load inbox.", "error");
    }
  }, [show]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await inboxService.create(content.trim());
      setContent("");
      load();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't add item.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Inbox</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Capture a thought quickly without deciding where it belongs yet.
      </p>

      <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Need spare battery labels for EICMA…"
          maxLength={1000}
        />
        <Button type="submit" variant="primary" disabled={submitting || !content.trim()}>
          Add
        </Button>
      </form>

      {items === null ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="Inbox zero" description="Nothing waiting to be triaged." />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <InboxRow key={item.id} item={item} onResolved={load} />
          ))}
        </ul>
      )}
    </div>
  );
}
