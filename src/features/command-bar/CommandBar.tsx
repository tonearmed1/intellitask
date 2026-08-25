import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Search, FolderKanban, ListTodo, Settings, Inbox, CalendarDays } from "lucide-react";
import { useCommandBar } from "./CommandBarContext";
import { searchService, type SearchResults } from "@/services/search";
import { cn } from "@/lib/cn";

interface StaticCommand {
  id: string;
  label: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  run: (navigate: ReturnType<typeof useNavigate>) => void;
}

const STATIC_COMMANDS: StaticCommand[] = [
  {
    id: "new-project",
    label: "New AI project",
    hint: "Describe an outcome and let AI build the plan",
    icon: FolderKanban,
    run: (navigate) => navigate("/projects?new=ai"),
  },
  {
    id: "new-quick-task",
    label: "New quick task",
    hint: "Add a single task without decomposition",
    icon: ListTodo,
    run: (navigate) => navigate("/projects?new=quick"),
  },
  { id: "goto-today", label: "Go to Today", icon: CalendarDays, run: (navigate) => navigate("/") },
  {
    id: "goto-projects",
    label: "Go to Projects",
    icon: FolderKanban,
    run: (navigate) => navigate("/projects"),
  },
  { id: "goto-inbox", label: "Go to Inbox", icon: Inbox, run: (navigate) => navigate("/inbox") },
  {
    id: "goto-settings",
    label: "Open settings",
    icon: Settings,
    run: (navigate) => navigate("/settings"),
  },
];

export function CommandBar() {
  const { open, setOpen } = useCommandBar();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      searchService
        .search(query)
        .then(setResults)
        .catch(() => setResults(null));
    }, 150);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const filteredCommands = useMemo(() => {
    if (query.trim().length === 0) return STATIC_COMMANDS;
    const q = query.toLowerCase();
    return STATIC_COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  const hasSearchResults =
    results && (results.projects.length > 0 || results.tasks.length > 0 || results.contextEntries.length > 0);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="fixed inset-0 bg-neutral-950/40" onClick={() => setOpen(false)} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command bar"
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Search className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or type a command…"
            className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          <kbd className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-400 dark:border-neutral-700">
            Esc
          </kbd>
        </div>
        <div className="max-h-96 overflow-y-auto py-2">
          {query.trim().length >= 2 && hasSearchResults ? (
            <SearchResultsList results={results} onNavigate={setOpen} />
          ) : (
            <ul>
              {filteredCommands.map((cmd) => (
                <li key={cmd.id}>
                  <button
                    type="button"
                    onClick={() => {
                      cmd.run(navigate);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    <cmd.icon className="h-4 w-4 text-neutral-400" />
                    <span>{cmd.label}</span>
                    {cmd.hint && (
                      <span className="ml-auto truncate text-xs text-neutral-400">{cmd.hint}</span>
                    )}
                  </button>
                </li>
              ))}
              {filteredCommands.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-neutral-400">No matches</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SearchResultsList({
  results,
  onNavigate,
}: {
  results: SearchResults;
  onNavigate: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  return (
    <div>
      {results.projects.length > 0 && (
        <ResultGroup title="Projects">
          {results.projects.map((p) => (
            <ResultRow
              key={p.id}
              label={p.title}
              onClick={() => {
                navigate(`/projects/${p.id}`);
                onNavigate(false);
              }}
            />
          ))}
        </ResultGroup>
      )}
      {results.tasks.length > 0 && (
        <ResultGroup title="Tasks">
          {results.tasks.map((t) => (
            <ResultRow
              key={t.id}
              label={t.title}
              hint={t.projectTitle}
              onClick={() => {
                navigate(`/projects/${t.projectId}`);
                onNavigate(false);
              }}
            />
          ))}
        </ResultGroup>
      )}
      {results.contextEntries.length > 0 && (
        <ResultGroup title="Context">
          {results.contextEntries.map((c) => (
            <ResultRow
              key={c.id}
              label={c.title}
              onClick={() => {
                navigate("/context");
                onNavigate(false);
              }}
            />
          ))}
        </ResultGroup>
      )}
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        {title}
      </p>
      <ul>{children}</ul>
    </div>
  );
}

function ResultRow({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
        )}
      >
        <span className="truncate">{label}</span>
        {hint && <span className="ml-auto truncate text-xs text-neutral-400">{hint}</span>}
      </button>
    </li>
  );
}
