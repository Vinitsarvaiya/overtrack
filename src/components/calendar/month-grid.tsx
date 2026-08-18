import { memo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  MONTH_NAMES,
  STATUS_DOT_CLASS,
  WEEKDAY_LABELS,
  buildMonthGrid,
  formatMoney,
  type DaySummary,
} from "@/lib/calendar";
import { formatHours } from "@/lib/overtime";

type Props = {
  year: number;
  monthIndex: number;
  summaries: Map<string, DaySummary>;
  selected: string | null;
  today: string;
  currency: string;
  onSelect: (dateKey: string) => void;
};

function DayCell({
  dateKey,
  day,
  summary,
  isToday,
  isSelected,
  currency,
  onSelect,
}: {
  dateKey: string;
  day: number;
  summary: DaySummary | undefined;
  isToday: boolean;
  isSelected: boolean;
  currency: string;
  onSelect: (dateKey: string) => void;
}) {
  const button = (
    <button
      type="button"
      onClick={() => onSelect(dateKey)}
      aria-label={`${dateKey}${summary ? `, ${formatHours(summary.overtime)} overtime` : ", no records"}`}
      aria-current={isToday ? "date" : undefined}
      aria-pressed={isSelected}
      className={cn(
        "relative flex aspect-square w-full flex-col items-center justify-center rounded-md text-[11px] leading-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        summary?.weekend ? "text-muted-foreground" : "text-foreground",
        summary ? "font-medium" : "font-normal",
        isSelected
          ? "bg-primary text-primary-foreground"
          : isToday
            ? "bg-accent ring-1 ring-primary"
            : summary
              ? "bg-secondary hover:bg-accent"
              : "hover:bg-accent",
      )}
    >
      <span className="tabular-nums">{day}</span>
      <span className="mt-0.5 flex h-1 items-center gap-0.5">
        {summary?.statuses.slice(0, 3).map((status) => (
          <span
            key={status}
            className={cn("size-1 rounded-full", STATUS_DOT_CLASS[status])}
            aria-hidden
          />
        ))}
      </span>
    </button>
  );

  if (!summary) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top" className="space-y-0.5 text-xs">
        <p className="font-medium">{dateKey}</p>
        <p>Overtime: {formatHours(summary.overtime)}</p>
        <p>Earnings: {formatMoney(summary.earnings, currency)}</p>
        <p>
          {summary.entries.length} {summary.entries.length === 1 ? "entry" : "entries"} ·{" "}
          {summary.statuses.join(", ")}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

const MemoDayCell = memo(DayCell);

function MonthGridBase({
  year,
  monthIndex,
  summaries,
  selected,
  today,
  currency,
  onSelect,
}: Props) {
  const cells = buildMonthGrid(year, monthIndex);
  return (
    <section className="rounded-xl border bg-card p-3 shadow-panel" aria-label={MONTH_NAMES[monthIndex]}>
      <h3 className="mb-2 text-sm font-semibold">{MONTH_NAMES[monthIndex]}</h3>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((label, index) => (
          <span
            key={`${label}-${index}`}
            aria-hidden
            className="pb-1 text-center text-[10px] font-medium text-muted-foreground"
          >
            {label}
          </span>
        ))}
        {cells.map((cell, index) =>
          cell ? (
            <MemoDayCell
              key={cell.dateKey}
              dateKey={cell.dateKey}
              day={cell.day}
              summary={summaries.get(cell.dateKey)}
              isToday={cell.dateKey === today}
              isSelected={cell.dateKey === selected}
              currency={currency}
              onSelect={onSelect}
            />
          ) : (
            <span key={`pad-${index}`} className="aspect-square" aria-hidden />
          ),
        )}
      </div>
    </section>
  );
}

/** Memoized so selecting a date only re-renders the affected months. */
export const MonthGrid = memo(MonthGridBase);
