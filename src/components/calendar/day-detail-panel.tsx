import { Check, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateLong, formatMoney, type DaySummary } from "@/lib/calendar";
import {
  EDITABLE_STATUSES,
  STATUS_LABELS,
  formatHours,
  formatTime,
  overtimeHours,
  type TimeFormat,
} from "@/lib/overtime";
import type { Entry } from "@/lib/data";

type Props = {
  dateKey: string | null;
  summary: DaySummary | undefined;
  currency: string;
  timeFormat: TimeFormat;
  standard: number | null;
  nameFor: (userId: string) => string;
  canApprove: boolean;
  canEdit: (entry: Entry) => boolean;
  onApprove: (entry: Entry) => void;
  onReject: (entry: Entry) => void;
  onEdit: (entry: Entry) => void;
  isLoading?: boolean;
};

function statusVariant(status: string) {
  if (status === "approved") return "default" as const;
  if (status === "rejected") return "destructive" as const;
  return "outline" as const;
}

export function DayDetailPanel({
  dateKey,
  summary,
  currency,
  timeFormat,
  standard,
  nameFor,
  canApprove,
  canEdit,
  onApprove,
  onReject,
  onEdit,
  isLoading,
}: Props) {
  if (!dateKey) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-panel">
        Select a day in the calendar to see its entries, hours and earnings.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-panel">
      <div className="space-y-1 p-4">
        <h2 className="text-sm font-semibold">{formatDateLong(dateKey)}</h2>
        <p className="text-xs text-muted-foreground">
          {summary ? `${summary.entries.length} entries logged` : "No entries logged"}
        </p>
      </div>
      <Separator />
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 p-4 text-sm">
            <Stat label="Worked" value={formatHours(summary?.worked ?? 0)} />
            <Stat label="Break" value={formatHours(summary?.breaks ?? 0)} />
            <Stat label="Overtime" value={formatHours(summary?.overtime ?? 0)} accent />
            <Stat label="Earnings" value={formatMoney(summary?.earnings ?? 0, currency)} />
          </dl>
          <Separator />
          <ScrollArea className="max-h-[420px]">
            <ul className="divide-y">
              {(summary?.entries ?? []).map((entry) => (
                <li key={entry.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{nameFor(entry.user_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(entry.start_time, timeFormat)} –{" "}
                        {formatTime(entry.end_time, timeFormat)} · {entry.category}
                      </p>
                    </div>
                    <Badge variant={statusVariant(entry.status)}>
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Overtime {formatHours(overtimeHours(entry, standard))}
                    {entry.rejection_reason ? ` · Reason: ${entry.rejection_reason}` : ""}
                  </p>

                  {entry.notes ? <p className="text-xs">{entry.notes}</p> : null}
                  <div className="flex flex-wrap gap-1">
                    {canApprove && entry.status !== "approved" ? (
                      <Button size="sm" variant="outline" onClick={() => onApprove(entry)}>
                        <Check className="size-3.5" /> Approve
                      </Button>
                    ) : null}
                    {canApprove && entry.status !== "rejected" ? (
                      <Button size="sm" variant="outline" onClick={() => onReject(entry)}>
                        <X className="size-3.5" /> Reject
                      </Button>
                    ) : null}
                    {canEdit(entry) && EDITABLE_STATUSES.includes(entry.status) ? (
                      <Button size="sm" variant="ghost" onClick={() => onEdit(entry)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
              {!summary || summary.entries.length === 0 ? (
                <li className="p-6 text-center text-sm text-muted-foreground">
                  Nothing logged on this day.
                </li>
              ) : null}
            </ul>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={accent ? "text-sm font-semibold text-primary" : "text-sm font-semibold"}>
        {value}
      </dd>
    </div>
  );
}
