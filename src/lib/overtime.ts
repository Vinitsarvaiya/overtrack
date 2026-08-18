/**
 * Work time calculation helpers.
 * All returned hour values are rounded to two decimals.
 * Times are stored as "HH:MM[:SS]" (24h) and only formatted for display.
 */

export const CATEGORIES = [
  "Development",
  "Meeting",
  "Production Support",
  "Deployment",
  "Training",
  "Bug Fix",
  "Weekend",
  "Holiday",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const DEFAULT_TAGS = [
  "Development",
  "Testing",
  "Meeting",
  "Support",
  "Research",
  "Deployment",
  "Training",
  "Documentation",
] as const;

/** Workflow states. `pending` is kept for legacy rows. */
export const STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "reopened",
  "pending",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  reopened: "Reopened",
  pending: "Submitted",
};

/** Statuses in which the owner of an entry may still edit it. */
export const EDITABLE_STATUSES = ["draft", "rejected", "reopened", "pending"];

export type EntryLike = {
  entry_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  break_start?: string | null;
  break_end?: string | null;
  overtime_override?: number | null;
};

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Parse "HH:MM" or "HH:MM:SS" into minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** Total minutes between start and end, wrapping past midnight for night shifts. */
export function totalMinutes(entry: EntryLike): number {
  const start = timeToMinutes(entry.start_time);
  const end = timeToMinutes(entry.end_time);
  return end > start ? end - start : 1440 - start + end;
}

/** Break minutes, derived from break start/end when both are provided. */
export function breakMinutes(entry: EntryLike): number {
  if (entry.break_start && entry.break_end) {
    const start = timeToMinutes(entry.break_start);
    const end = timeToMinutes(entry.break_end);
    return Math.max(0, end > start ? end - start : 1440 - start + end);
  }
  return Math.max(0, entry.break_minutes || 0);
}

/** Minutes actually worked: total duration minus break. */
export function netMinutes(entry: EntryLike): number {
  return Math.max(0, totalMinutes(entry) - breakMinutes(entry));
}

export function totalHours(entry: EntryLike): number {
  return round2(totalMinutes(entry) / 60);
}

export function breakHours(entry: EntryLike): number {
  return round2(breakMinutes(entry) / 60);
}

export function workedHours(entry: EntryLike): number {
  return round2(netMinutes(entry) / 60);
}

/**
 * Calculated overtime, unless a manual override is set on the entry.
 * `standardDailyHours` of `null` means the workspace has automatic overtime
 * disabled — nothing is derived and only manual overrides count.
 */
export function overtimeHours(entry: EntryLike, standardDailyHours: number | null): number {
  if (entry.overtime_override !== null && entry.overtime_override !== undefined) {
    return round2(Number(entry.overtime_override));
  }
  if (standardDailyHours === null) return 0;
  return round2(Math.max(0, workedHours(entry) - standardDailyHours));
}

export function sumWorked(entries: EntryLike[]): number {
  return round2(entries.reduce((total, entry) => total + workedHours(entry), 0));
}

export function sumOvertime(entries: EntryLike[], standardDailyHours: number | null): number {
  return round2(
    entries.reduce((total, entry) => total + overtimeHours(entry, standardDailyHours), 0),
  );
}


export function formatHours(hours: number): string {
  return `${round2(hours).toFixed(2)}h`;
}

/** Human "8h 30m" style label. */
export function formatDuration(hours: number): string {
  const total = Math.round(hours * 60);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

export type TimeFormat = "12h" | "24h";

/** Render a stored "HH:MM[:SS]" value using the workspace time format. */
export function formatTime(time: string | null | undefined, format: TimeFormat = "24h"): string {
  if (!time) return "—";
  const [rawHour = "0", rawMinute = "00"] = time.split(":");
  const hour = Number(rawHour);
  const minute = rawMinute.padStart(2, "0");
  if (format === "24h") return `${String(hour).padStart(2, "0")}:${minute}`;
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute} ${suffix}`;
}

export function isWeekend(dateISO: string): boolean {
  const day = new Date(`${dateISO}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

/** Minute range of an entry, extended past 1440 for overnight shifts. */
export function minuteRange(start: string, end: string): [number, number] {
  const from = timeToMinutes(start);
  const to = timeToMinutes(end);
  return [from, to > from ? to : to + 1440];
}

/** True when two same-day ranges overlap (client mirror of the DB guard). */
export function rangesOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}
