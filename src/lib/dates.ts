import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(dateStr: string | null | undefined, pattern = "d MMM yyyy"): string {
  if (!dateStr) return "";
  const d = parseISO(dateStr);
  if (!isValid(d)) return "";
  return format(d, pattern);
}

export function formatDateShort(dateStr: string | null | undefined): string {
  return formatDate(dateStr, "d MMM");
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  if (!isValid(d)) return null;
  return differenceInCalendarDays(d, new Date());
}

export function relativeDueLabel(dateStr: string | null | undefined): string {
  const days = daysUntil(dateStr);
  if (days === null) return "";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days}d`;
  return `Due ${formatDateShort(dateStr)}`;
}
