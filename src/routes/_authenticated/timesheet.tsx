import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  Check,
  Download,
  History,
  Lock,
  Pencil,
  Printer,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MonthPicker } from "@/components/ui/date-pickers";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EntryDialog } from "@/components/entry-dialog";
import { EntryHistoryDrawer } from "@/components/entry-history-drawer";
import { RejectEntryDialog } from "@/components/reject-entry-dialog";
import { can, useWorkspace } from "@/components/workspace-provider";
import {
  useCalendarDays,
  useDeleteEntry,
  useEntries,
  useEntryWorkflow,
  useWorkspaceMembers,
  type Entry,
} from "@/lib/data";
import {
  baseStandardHours,
  calendarDayMap,
  DAY_TYPE_DOT,
  DAY_TYPE_LABEL,
  CALENDAR_LEGEND,
  showsBreaks,
  showsOvertime,
  standardHoursFor,
} from "@/lib/working-calendar";
import { cn } from "@/lib/utils";

import {
  DEFAULT_TAGS,
  EDITABLE_STATUSES,
  STATUSES,
  STATUS_LABELS,
  breakHours,
  formatHours,
  formatTime,
  isWeekend,
  overtimeHours,
  round2,
  workedHours,
  type TimeFormat,
} from "@/lib/overtime";

export const Route = createFileRoute("/_authenticated/timesheet")({
  head: () => ({
    meta: [
      { title: "Timesheet — OverTrack" },
      {
        name: "description",
        content: "Monthly timesheet with working time, overtime, approvals and CSV export.",
      },
      { property: "og:title", content: "Timesheet — OverTrack" },
      {
        property: "og:description",
        content: "Monthly timesheet with working time, overtime, approvals and CSV export.",
      },
    ],
  }),
  component: TimesheetPage,
});

function statusVariant(status: string) {
  if (status === "approved") return "default" as const;
  if (status === "rejected") return "destructive" as const;
  return "outline" as const;
}

function TimesheetPage() {
  const { workspace, role, user, permissions: myPermissions } = useWorkspace();
  const { data: entries = [], isLoading } = useEntries(workspace?.id);
  const { data: members = [] } = useWorkspaceMembers(workspace?.id);
  const remove = useDeleteEntry(workspace?.id);
  const workflow = useEntryWorkflow(workspace);
  const permissions = can(role, myPermissions, workspace);

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [tag, setTag] = useState("all");
  const [status, setStatusFilter] = useState("all");
  const [person, setPerson] = useState("all");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<Entry | null>(null);
  const [rejectingEntry, setRejectingEntry] = useState<Entry | null>(null);

  const { data: calendarDays = [] } = useCalendarDays(workspace?.id);
  const dayMap = useMemo(() => calendarDayMap(calendarDays), [calendarDays]);
  const base = baseStandardHours(workspace);
  const standardFor = useCallback(
    (dateKey: string) => standardHoursFor(base, dayMap.get(dateKey)),
    [base, dayMap],
  );
  const breaksOn = showsBreaks(workspace);
  const overtimeOn = showsOvertime(workspace);
  const columnCount = 8 + (breaksOn ? 1 : 0) + (overtimeOn ? 1 : 0);

  const timeFormat = (workspace?.time_format as TimeFormat) ?? "24h";
  const tagOptions = workspace?.tags?.length ? workspace.tags : [...DEFAULT_TAGS];

  const rows = useMemo(
    () =>
      entries
        .filter((entry) => entry.entry_date.startsWith(month))
        .filter((entry) => tag === "all" || (entry.tags ?? []).includes(tag))
        .filter((entry) => status === "all" || entry.status === status)
        .filter((entry) => person === "all" || entry.user_id === person)
        .sort(
          (a, b) =>
            a.entry_date.localeCompare(b.entry_date) || a.start_time.localeCompare(b.start_time),
        ),
    [entries, month, tag, status, person],
  );

  const totals = useMemo(
    () => ({
      worked: round2(rows.reduce((sum, entry) => sum + workedHours(entry), 0)),
      overtime: round2(
        rows.reduce((sum, entry) => sum + overtimeHours(entry, standardFor(entry.entry_date)), 0),
      ),
      days: new Set(rows.map((entry) => entry.entry_date)).size,
    }),
    [rows, standardFor],
  );


  function nameFor(userId: string) {
    const member = members.find((item) => item.user_id === userId);
    return member?.profile?.full_name || member?.profile?.email || "Member";
  }

  function run(entry: Entry, action: "submit" | "approve" | "reject" | "reopen") {
    if (!user) return;
    workflow.mutate(
      { entry, action, actorId: user.id },
      {
        onSuccess: () =>
          toast.success(
            action === "submit"
              ? "Entry submitted"
              : action === "approve"
                ? "Entry approved"
                : action === "reject"
                  ? "Entry rejected"
                  : "Entry reopened",
          ),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Action failed"),
      },
    );
  }

  function exportCsv() {
    const header = [
      "Date",
      "Member",
      "Start",
      "End",
      ...(breaksOn ? ["Break"] : []),
      "Working",
      ...(overtimeOn ? ["Overtime"] : []),
      "Status",
      "Tags",
      "Notes",
    ];
    const lines = rows.map((entry) =>
      [
        entry.entry_date,
        nameFor(entry.user_id),
        formatTime(entry.start_time, timeFormat),
        formatTime(entry.end_time, timeFormat),
        ...(breaksOn ? [formatHours(breakHours(entry))] : []),
        workedHours(entry),
        ...(overtimeOn ? [overtimeHours(entry, standardFor(entry.entry_date))] : []),
        STATUS_LABELS[entry.status] ?? entry.status,
        (entry.tags ?? []).join(" | "),
        (entry.notes ?? "").replace(/"/g, '""'),
      ]
        .map((cell) => `"${cell}"`)
        .join(","),
    );

    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `overtrack-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Timesheet exported");
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Timesheet</h1>
          <p className="text-sm text-muted-foreground">
            Multiple entries per day, automatic totals and approvals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Log time
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Print / PDF
          </Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <MonthPicker value={month} onChange={setMonth} ariaLabel="Timesheet month" />
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger>
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {tagOptions.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.filter((item) => item !== "pending").map((item) => (
                <SelectItem key={item} value={item}>
                  {STATUS_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={person} onValueChange={setPerson}>
            <SelectTrigger>
              <SelectValue placeholder="Member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.profile?.full_name || member.profile?.email || "Member"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  {breaksOn ? <TableHead>Break</TableHead> : null}
                  <TableHead>Working</TableHead>
                  {overtimeOn ? <TableHead>Overtime</TableHead> : null}
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="print:hidden" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((entry) => {
                  const mine = entry.user_id === user?.id;
                  const editable =
                    !entry.locked &&
                    (permissions.manageAll || (mine && permissions.edit)) &&
                    (permissions.manageAll || EDITABLE_STATUSES.includes(entry.status));
                  const canSubmit =
                    mine && EDITABLE_STATUSES.includes(entry.status) && !entry.locked;
                  const dayInfo = dayMap.get(entry.entry_date);
                  return (
                    <TableRow
                      key={entry.id}
                      className={isWeekend(entry.entry_date) ? "bg-muted/40" : ""}
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {dayInfo ? (
                            <span
                              title={DAY_TYPE_LABEL[dayInfo.day_type] ?? dayInfo.day_type}
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                DAY_TYPE_DOT[dayInfo.day_type],
                              )}
                              aria-hidden
                            />
                          ) : null}
                          {entry.entry_date}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {nameFor(entry.user_id)}
                      </TableCell>
                      <TableCell>{formatTime(entry.start_time, timeFormat)}</TableCell>
                      <TableCell>{formatTime(entry.end_time, timeFormat)}</TableCell>
                      {breaksOn ? <TableCell>{formatHours(breakHours(entry))}</TableCell> : null}
                      <TableCell>{formatHours(workedHours(entry))}</TableCell>
                      {overtimeOn ? (
                        <TableCell className="text-primary">
                          {formatHours(overtimeHours(entry, standardFor(entry.entry_date)))}
                        </TableCell>
                      ) : null}

                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Badge variant={statusVariant(entry.status)}>
                            {STATUS_LABELS[entry.status] ?? entry.status}
                          </Badge>
                          {entry.locked ? (
                            <Lock className="size-3 text-muted-foreground" aria-label="Locked" />
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-muted-foreground">
                        {(entry.tags ?? []).join(", ")}
                      </TableCell>
                      <TableCell className="print:hidden">
                        <div className="flex justify-end gap-1">
                          {canSubmit ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Submit"
                              onClick={() => run(entry, "submit")}
                            >
                              <Send className="size-4" />
                            </Button>
                          ) : null}
                          {permissions.approve && entry.status !== "approved" ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Approve"
                              onClick={() => run(entry, "approve")}
                            >
                              <Check className="size-4" />
                            </Button>
                          ) : null}
                          {permissions.approve &&
                          workspace?.allow_reject !== false &&
                          entry.status !== "rejected" ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Reject"
                              onClick={() => setRejectingEntry(entry)}
                            >
                              <X className="size-4" />
                            </Button>
                          ) : null}
                          {permissions.approve &&
                          workspace?.allow_reopen !== false &&
                          entry.status === "approved" ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Reopen"
                              onClick={() => run(entry, "reopen")}
                            >
                              <RotateCcw className="size-4" />
                            </Button>
                          ) : null}
                          {permissions.manageAll ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="History"
                              onClick={() => setHistoryEntry(entry)}
                            >
                              <History className="size-4" />
                            </Button>
                          ) : null}
                          {editable ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Edit"
                                onClick={() => {
                                  setEditing(entry);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Delete"
                                onClick={() =>
                                  remove.mutate(entry.id, {
                                    onSuccess: () => toast.success("Entry deleted"),
                                    onError: (error) =>
                                      toast.error(
                                        error instanceof Error
                                          ? error.message
                                          : "Could not delete entry",
                                      ),
                                  })
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="py-10 text-center text-muted-foreground">
                      No entries for this month.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={breaksOn ? 5 : 4}>{totals.days} working days</TableCell>
                  <TableCell>{formatHours(totals.worked)}</TableCell>
                  {overtimeOn ? (
                    <TableCell className="text-primary">{formatHours(totals.overtime)}</TableCell>
                  ) : null}
                  <TableCell colSpan={3} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Colour key for the working-calendar markers shown next to dates. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground print:hidden">
        <span className="font-medium text-foreground">Legend</span>
        {CALENDAR_LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", item.dotClass)} aria-hidden />
            {item.label}
          </span>
        ))}
      </div>


      <EntryDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        entry={editing}
      />
      <EntryHistoryDrawer
        entry={historyEntry}
        onOpenChange={(open) => !open && setHistoryEntry(null)}
        nameFor={nameFor}
      />
      <RejectEntryDialog
        open={Boolean(rejectingEntry)}
        onOpenChange={(open) => {
          if (!open) setRejectingEntry(null);
        }}
        onConfirm={(reason) => {
          if (!rejectingEntry || !user) return;
          workflow.mutate(
            { entry: rejectingEntry, action: "reject", reason, actorId: user.id },
            {
              onSuccess: () => {
                toast.success("Entry rejected");
                setRejectingEntry(null);
              },
              onError: (error) =>
                toast.error(error instanceof Error ? error.message : "Action failed"),
            },
          );
        }}
      />
    </div>
  );
}
