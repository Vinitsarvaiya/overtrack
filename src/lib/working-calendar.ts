/**
 * Working-calendar helpers.
 * A workspace can override individual dates as holidays, half days, custom
 * working hours, or explicit regular working days. These overrides feed the
 * per-day standard hours used for overtime, and the calendar colour coding.
 */
import type { Tables } from "@/integrations/supabase/types";

export type CalendarDay = Tables<"workspace_calendar_days">;

export type DayType = "holiday" | "half_day" | "custom" | "working";

export const DAY_TYPES: {
  value: DayType;
  label: string;
  hint: string;
  dotClass: string;
  tintClass: string;
}[] = [
  {
    value: "holiday",
    label: "Holiday",
    hint: "No working hours expected",
    dotClass: "bg-day-holiday",
    tintClass: "ring-1 ring-day-holiday/60",
  },
  {
    value: "half_day",
    label: "Half day",
    hint: "Half of the standard working hours",
    dotClass: "bg-day-half",
    tintClass: "ring-1 ring-day-half/60",
  },
  {
    value: "custom",
    label: "Custom working hours",
    hint: "Set an exact number of hours for this date",
    dotClass: "bg-day-custom",
    tintClass: "ring-1 ring-day-custom/60",
  },
  {
    value: "working",
    label: "Regular working day",
    hint: "Standard working hours apply",
    dotClass: "bg-day-working",
    tintClass: "ring-1 ring-day-working/60",
  },
];

export const DAY_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DAY_TYPES.map((item) => [item.value, item.label]),
);

export const DAY_TYPE_DOT: Record<string, string> = Object.fromEntries(
  DAY_TYPES.map((item) => [item.value, item.dotClass]),
);

export const DAY_TYPE_TINT: Record<string, string> = Object.fromEntries(
  DAY_TYPES.map((item) => [item.value, item.tintClass]),
);

/** Legend rendered under the calendar, including "Today". */
export const CALENDAR_LEGEND: { label: string; dotClass: string }[] = [
  ...DAY_TYPES.map((item) => ({ label: item.label, dotClass: item.dotClass })),
  { label: "Today", dotClass: "bg-day-today" },
];

export function calendarDayMap(days: CalendarDay[]): Map<string, CalendarDay> {
  return new Map(days.map((day) => [day.day_date, day]));
}

/**
 * Standard hours that apply to one date.
 * `base` of `null` (automatic overtime disabled) always resolves to `null`.
 */
export function standardHoursFor(
  base: number | null,
  day: CalendarDay | undefined,
): number | null {
  if (base === null) return null;
  if (!day) return base;
  if (day.day_type === "holiday") return 0;
  if (day.day_type === "half_day") return base / 2;
  if (day.day_type === "custom") return day.hours === null ? base : Number(day.hours);
  return base;
}

/** Curried resolver used by pages that mix entries from many dates. */
export function makeStandardResolver(
  base: number | null,
  days: Map<string, CalendarDay>,
): (dateKey: string) => number | null {
  return (dateKey: string) => standardHoursFor(base, days.get(dateKey));
}

type WorkspaceFlags = {
  standard_daily_hours?: number | string | null;
  enable_standard_hours?: boolean | null;
  enable_overtime?: boolean | null;
  enable_breaks?: boolean | null;
} | null | undefined;

/** Base standard hours, or `null` when automatic overtime is disabled. */
export function baseStandardHours(workspace: WorkspaceFlags): number | null {
  if (!workspace) return 8;
  if (workspace.enable_standard_hours === false) return null;
  return Number(workspace.standard_daily_hours ?? 8);
}

/** Overtime UI is only meaningful with standard hours and overtime both on. */
export function showsOvertime(workspace: WorkspaceFlags): boolean {
  if (!workspace) return true;
  return workspace.enable_standard_hours !== false && workspace.enable_overtime !== false;
}

/** Break UI is hidden entirely when break tracking is off. */
export function showsBreaks(workspace: WorkspaceFlags): boolean {
  return !workspace || workspace.enable_breaks !== false;
}
