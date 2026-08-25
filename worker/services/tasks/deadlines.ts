/** Pure date-math helpers used for backward deadline planning and overdue checks. */

/** Returns an ISO `YYYY-MM-DD` date `daysBefore` days before `deadline`, or null if there's no deadline. */
export function computeBackwardDate(
  deadline: string | null | undefined,
  daysBefore: number,
): string | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - daysBefore);
  return d.toISOString().slice(0, 10);
}

/** Whole days between `fromDate` and `toDate` (positive = toDate is in the future). */
export function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const msPerDay = 86_400_000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

export function isOverdue(
  dueDate: string | null | undefined,
  currentDate: string,
  status: string,
): boolean {
  if (!dueDate) return false;
  if (status === "done" || status === "cancelled") return false;
  return new Date(dueDate).getTime() < new Date(currentDate).getTime();
}

export function isDueToday(
  dueDate: string | null | undefined,
  currentDate: string,
): boolean {
  if (!dueDate) return false;
  return dueDate.slice(0, 10) === currentDate.slice(0, 10);
}
