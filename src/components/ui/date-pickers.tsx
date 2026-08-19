import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MONTH_NAMES, WEEKDAY_LABELS, buildMonthGrid, formatDateLong, todayKey } from "@/lib/calendar";
import { cn } from "@/lib/utils";

export function DatePicker({
  value,
  onChange,
  ariaLabel = "Date",
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const activeDate = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(activeDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(activeDate.getMonth());
  const cells = buildMonthGrid(viewYear, viewMonth);
  const today = todayKey();

  useEffect(() => {
    if (!open || !value) return;
    const next = new Date(`${value}T00:00:00`);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }, [open, value]);

  function stepMonth(direction: -1 | 1) {
    const next = new Date(viewYear, viewMonth + direction, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="flex h-10 w-full items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 text-left shadow-sm transition-colors hover:bg-muted/30"
        >
          <span className="truncate font-medium">{formatDateLong(value)}</span>
          <CalendarDays className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[308px] rounded-xl border-border/70 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => stepMonth(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="text-sm font-semibold">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => stepMonth(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="pb-1 text-center text-[10px] font-medium text-muted-foreground"
              >
                {label}
              </span>
            ))}
            {cells.map((cell, index) =>
              cell ? (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => {
                    onChange(cell.dateKey);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex aspect-square w-full items-center justify-center rounded-md text-[11px] font-medium tabular-nums transition-colors",
                    cell.dateKey === value
                      ? "bg-primary text-primary-foreground"
                      : cell.dateKey === today
                        ? "bg-accent text-accent-foreground ring-1 ring-primary"
                        : "hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {cell.day}
                </button>
              ) : (
                <span key={`date-pad-${index}`} className="aspect-square" aria-hidden />
              ),
            )}
          </div>

          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const current = todayKey();
                onChange(current);
                const next = new Date(`${current}T00:00:00`);
                setViewYear(next.getFullYear());
                setViewMonth(next.getMonth());
              }}
            >
              Today
            </Button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MonthPicker({
  value,
  onChange,
  ariaLabel = "Month",
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, month] = value.split("-").map(Number);
  const safeYear = year || new Date().getFullYear();
  const safeMonth = (month || 1) - 1;
  const [viewYear, setViewYear] = useState(safeYear);

  useEffect(() => {
    if (!open) return;
    setViewYear(safeYear);
  }, [open, safeYear]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="flex h-10 w-full items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 text-left shadow-sm transition-colors hover:bg-muted/30"
        >
          <span className="truncate font-medium">
            {MONTH_NAMES[safeMonth]} {safeYear}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[308px] rounded-xl border-border/70 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => setViewYear((current) => current - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="text-sm font-semibold">{viewYear}</div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setViewYear((current) => current + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MONTH_NAMES.map((name, index) => {
              const monthValue = `${viewYear}-${String(index + 1).padStart(2, "0")}`;
              const active = monthValue === value;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(monthValue);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-background/70 hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
