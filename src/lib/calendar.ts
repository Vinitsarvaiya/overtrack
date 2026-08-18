/**
 * Yearly-calendar helpers: month grids, per-day aggregation and money formatting.
 * All date handling is calendar-local (no UTC shifting) and string based ("YYYY-MM-DD").
 */
import { overtimeHours, round2, workedHours, breakHours, isWeekend } from "@/lib/overtime";
import type { Entry } from "@/lib/data";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Monday-first weekday initials, matching the yearly-planner layout. */
export const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function formatDateLong(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year!, (month ?? 1) - 1, day ?? 1).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export type MonthCell = { dateKey: string; day: number } | null;

/** 7-column grid for one month, Monday first, padded with nulls. */
export function buildMonthGrid(year: number, monthIndex: number): MonthCell[] {
  const first = new Date(year, monthIndex, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: MonthCell[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push({ dateKey: toDateKey(new Date(year, monthIndex, day)), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export type DayStatus =
  | "approved"
  | "submitted"
  | "rejected"
  | "holiday"
  | "leave"
  | "none";

export const STATUS_DOT_CLASS: Record<DayStatus, string> = {
  approved: "bg-dot-approved",
  submitted: "bg-dot-pending",
  rejected: "bg-dot-rejected",
  holiday: "bg-dot-holiday",
  leave: "bg-dot-leave",
  none: "bg-dot-none",
};


export const STATUS_DOT_LABEL: Record<DayStatus, string> = {
  approved: "Approved overtime",
  submitted: "Pending approval",
  rejected: "Rejected",
  holiday: "Holiday",
  leave: "Leave",
  none: "No records",
};

export const LEGEND: DayStatus[] = [
  "approved",
  "submitted",
  "rejected",
  "holiday",
  "leave",
  "none",
];

export type DaySummary = {
  dateKey: string;
  entries: Entry[];
  worked: number;
  breaks: number;
  overtime: number;
  earnings: number;
  statuses: DayStatus[];
  /** Dominant status, used for the day background tint. */
  primary: DayStatus;
  weekend: boolean;
};

function classify(entry: Entry): DayStatus {
  if (entry.category === "Holiday") return "holiday";
  if (entry.category === "Leave") return "leave";
  if (entry.status === "approved") return "approved";
  if (entry.status === "rejected") return "rejected";
  if (entry.status === "submitted" || entry.status === "pending") return "submitted";
  return "none";
}

const PRIORITY: DayStatus[] = ["rejected", "submitted", "approved", "leave", "holiday", "none"];

export type EarningRates = { hourly: number; overtime: number };

export function dayEarnings(
  entries: Entry[],
  standard: number | null,
  rates: EarningRates,
): number {
  return round2(
    entries.reduce((total, entry) => {
      const ot = overtimeHours(entry, standard);
      const base = Math.max(0, workedHours(entry) - ot);
      return total + base * rates.hourly + ot * rates.overtime;
    }, 0),
  );
}

/** Group entries by date into render-ready day summaries. */
export function summarizeByDay(
  entries: Entry[],
  standard: number | null,
  rates: EarningRates,
): Map<string, DaySummary> {
  const grouped = new Map<string, Entry[]>();
  for (const entry of entries) {
    const bucket = grouped.get(entry.entry_date) ?? [];
    bucket.push(entry);
    grouped.set(entry.entry_date, bucket);
  }
  const map = new Map<string, DaySummary>();
  for (const [dateKey, dayEntries] of grouped) {
    const statuses = [...new Set(dayEntries.map(classify))];
    const primary = PRIORITY.find((status) => statuses.includes(status)) ?? "none";
    map.set(dateKey, {
      dateKey,
      entries: dayEntries,
      worked: round2(dayEntries.reduce((sum, entry) => sum + workedHours(entry), 0)),
      breaks: round2(dayEntries.reduce((sum, entry) => sum + breakHours(entry), 0)),
      overtime: round2(dayEntries.reduce((sum, entry) => sum + overtimeHours(entry, standard), 0)),
      earnings: dayEarnings(dayEntries, standard, rates),
      statuses,
      primary,
      weekend: isWeekend(dateKey),
    });
  }
  return map;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function yearOptions(current: number): number[] {
  return Array.from({ length: 7 }, (_, index) => current + 2 - index);
}
