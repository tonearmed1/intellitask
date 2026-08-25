import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

interface CommandBarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandBarContext = createContext<CommandBarContextValue | null>(null);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable || tag === "SELECT";
}

export function CommandBarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <CommandBarContext.Provider value={{ open, setOpen }}>{children}</CommandBarContext.Provider>
  );
}

export function useCommandBar(): CommandBarContextValue {
  const ctx = useContext(CommandBarContext);
  if (!ctx) throw new Error("useCommandBar must be used within CommandBarProvider");
  return ctx;
}

export { isEditableTarget };
