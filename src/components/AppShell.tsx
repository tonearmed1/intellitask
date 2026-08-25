import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  Clock,
  FolderKanban,
  Inbox as InboxIcon,
  LogOut,
  Menu,
  Search,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { isEditableTarget, useCommandBar } from "@/features/command-bar/CommandBarContext";
import { cn } from "@/lib/cn";

/** Global "N" shortcut → new quick task, ignored while typing or with a modal/command-bar open. */
function useNewTaskShortcut(commandBarOpen: boolean) {
  const navigate = useNavigate();
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "n") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (commandBarOpen || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      navigate("/projects?new=quick");
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, commandBarOpen]);
}

const NAV_ITEMS = [
  { to: "/", label: "Today", icon: CalendarDays, end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/timeline", label: "Timeline", icon: Clock },
  { to: "/inbox", label: "Inbox", icon: InboxIcon },
  { to: "/context", label: "Context", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { username, logout } = useAuth();
  const { open: commandBarOpen, setOpen } = useCommandBar();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  useNewTaskShortcut(commandBarOpen);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-neutral-950/40 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 -translate-x-full flex-col overflow-y-auto border-r border-neutral-200 bg-white transition-transform duration-200 dark:border-neutral-800 dark:bg-neutral-900 md:static md:w-60 md:translate-x-0",
          navOpen && "translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Intellitask
          </span>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-3">
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setNavOpen(false);
            }}
            className="mb-3 flex w-full items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-400 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600"
          >
            <Search className="h-4 w-4" />
            <span>Search…</span>
            <kbd className="ml-auto hidden rounded border border-neutral-200 px-1 text-[10px] dark:border-neutral-700 sm:inline">
              ⌘K
            </kbd>
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-neutral-200 px-3 py-3 dark:border-neutral-800">
          <div className="flex items-center justify-between px-1">
            <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              {username}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Sign out"
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 md:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Intellitask
          </span>
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
