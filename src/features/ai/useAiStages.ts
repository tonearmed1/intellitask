import { useEffect, useRef, useState } from "react";

/**
 * Rotates through human-readable "stage" labels while a single AI call is
 * in flight. These are cosmetic — the backend makes one request — but give
 * the user a sense of progress instead of a bare spinner, without faking a
 * percentage.
 */
export function useAiStages(stages: string[], active: boolean, intervalMs = 1400): string {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setIndex((i) => Math.min(i + 1, stages.length - 1));
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active, intervalMs, stages.length]);

  return stages[index] ?? stages[stages.length - 1];
}

export const PROJECT_GENERATION_STAGES = [
  "Understanding the goal",
  "Identifying workstreams",
  "Building task structure",
  "Checking dependencies",
  "Finalising plan",
];

export const TASK_EXPAND_STAGES = ["Analysing the task", "Breaking it down", "Finalising subtasks"];
