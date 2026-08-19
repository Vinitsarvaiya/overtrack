import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Coins, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EntryDialog } from "@/components/entry-dialog";
import { MonthGrid } from "@/components/calendar/month-grid";
import { DayDetailPanel } from "@/components/calendar/day-detail-panel";
import { RejectEntryDialog } from "@/components/reject-entry-dialog";
import { can, useWorkspace } from "@/components/workspace-provider";
import { baseStandardHours } from "@/lib/working-calendar";
import {
  useEntries,
  useEntryWorkflow,
  useWorkspaceMembers,
  type Entry,
} from "@/lib/data";
import {
  LEGEND,
  MONTH_NAMES,
  STATUS_DOT_CLASS,
  STATUS_DOT_LABEL,
  formatMoney,
  summarizeByDay,
  todayKey,
  yearOptions,
} from "@/lib/calendar";
import {
  EDITABLE_STATUSES,
  formatHours,
  round2,
  type TimeFormat,
} from "@/lib/overtime";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Yearly Calendar — OverTrack" },
      {
        name: "description",
        content:
          "Twelve-month overtime planner with per-day status indicators, hours, earnings and approvals.",
      },
      { property: "og:title", content: "Yearly Calendar — OverTrack" },
      {
        property: "og:description",
        content:
          "Twelve-month overtime planner with per-day status indicators, hours, earnings and approvals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { workspace, role, user, permissions: myPermissions } = useWorkspace();
  const { data: entries = [], isLoading } = useEntries(workspace?.id);
  const { data: members = [] } = useWorkspaceMembers(workspace?.id);
  const workflow = useEntryWorkflow(workspace);
  const permissions = can(role, myPermissions, workspace);

  const today = todayKey();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [mobileMonth, setMobileMonth] = useState(() => new Date().getMonth());
  const [person, setPerson] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string | null>(today);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectingEntry, setRejectingEntry] = useState<Entry | null>(null);

  const standard = baseStandardHours(workspace);
  const currency = workspace?.currency ?? "USD";
  const timeFormat = (workspace?.time_format as TimeFormat) ?? "24h";
  const defaultRates = useMemo(
    () => ({
      hourly: Number(workspace?.hourly_rate ?? 0),
      overtime: Number(workspace?.overtime_hourly_rate ?? 0),
    }),
    [workspace?.hourly_rate, workspace?.overtime_hourly_rate],
  );
  const memberRateMap = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.user_id,
          {
            hourly: member.hourly_rate === null ? defaultRates.hourly : Number(member.hourly_rate),
            overtime:
              member.overtime_hourly_rate === null
                ? defaultRates.overtime
                : Number(member.overtime_hourly_rate),
          },
        ]),
      ),
    [defaultRates.hourly, defaultRates.overtime, members],
  );
  const resolveRates = useCallback(
    (entry: Entry) => memberRateMap.get(entry.user_id) ?? defaultRates,
    [defaultRates, memberRateMap],
  );

  const scoped = useMemo(() => {
    const base = permissions.manageAll
      ? entries
      : entries.filter((entry) => entry.user_id === user?.id);
    return base
      .filter((entry) => entry.entry_date.startsWith(String(year)))
      .filter((entry) =>
        !permissions.manageAll || person === "all" ? true : entry.user_id === person,
      )
      .filter((entry) => (status === "all" ? true : entry.status === status));
  }, [entries, permissions.manageAll, user?.id, year, person, status]);

  const summaries = useMemo(
    () => summarizeByDay(scoped, standard, resolveRates),
    [resolveRates, scoped, standard],
  );

  const stats = useMemo(() => {
    const days = [...summaries.values()];
    const overtime = round2(days.reduce((sum, day) => sum + day.overtime, 0));
    const earnings = round2(days.reduce((sum, day) => sum + day.earnings, 0));
    const count = (value: string) => scoped.filter((entry) => entry.status === value).length;
    return {
      overtime,
      earnings,
      pending: count("submitted") + count("pending"),
      approved: count("approved"),
      rejected: count("rejected"),
      average: days.length ? round2(overtime / days.length) : 0,
    };
  }, [summaries, scoped]);

  const nameFor = useCallback(
    (userId: string) => {
      const member = members.find((item) => item.user_id === userId);
      return member?.profile?.full_name || member?.profile?.email || "Member";
    },
    [members],
  );

  const handleSelect = useCallback((dateKey: string) => setSelected(dateKey), []);

  const runAction = useCallback(
    (entry: Entry, action: "approve" | "reject") => {
      if (!user) return;
      workflow.mutate(
        { entry, action, actorId: user.id },
        {
          onSuccess: () =>
            toast.success(action === "approve" ? "Entry approved" : "Entry rejected"),
          onError: (error) =>
            toast.error(error instanceof Error ? error.message : "Action failed"),
        },
      );
    },
    [user, workflow],
  );

  const selectedSummary = selected ? summaries.get(selected) : undefined;

  function bulkApprove() {
    const pending = (selectedSummary?.entries ?? []).filter(
      (entry) => entry.status !== "approved",
    );
    if (pending.length === 0) return toast.info("Nothing to approve on this day");
    pending.forEach((entry) => runAction(entry, "approve"));
  }

  const canEditEntry = useCallback(
    (entry: Entry) =>
      !entry.locked &&
      (permissions.manageAll || (entry.user_id === user?.id && permissions.edit)) &&
      (permissions.manageAll || EDITABLE_STATUSES.includes(entry.status)),
    [permissions.manageAll, permissions.edit, user?.id],
  );

  const monthProps = (monthIndex: number) => ({
    year,
    monthIndex,
    summaries,
    today,
    currency,
    onSelect: handleSelect,
    selected: selected?.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}`)
      ? selected
      : null,
  });

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Yearly calendar</h1>
            <p className="text-sm text-muted-foreground">
              Twelve months at a glance — click any day for its entries, hours and earnings.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous year"
              onClick={() => setYear((value) => value - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger className="w-[110px]" aria-label="Year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions(new Date().getFullYear()).map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next year"
              onClick={() => setYear((value) => value + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setYear(now.getFullYear());
                setMobileMonth(now.getMonth());
                setSelected(today);
              }}
            >
              <CalendarDays className="size-4" /> Today
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total overtime" value={formatHours(stats.overtime)} icon="clock" />
          <StatCard
            label="Total earnings"
            value={formatMoney(stats.earnings, currency)}
            icon="coins"
          />
          <StatCard label="Pending" value={String(stats.pending)} />
          <StatCard label="Approved" value={String(stats.approved)} />
          <StatCard label="Rejected" value={String(stats.rejected)} />
          <StatCard label="Avg daily OT" value={formatHours(stats.average)} />
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[170px]" aria-label="Status filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {permissions.manageAll ? (
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger className="w-[190px]" aria-label="Member filter">
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
            ) : null}
            <ul className="ml-auto flex flex-wrap items-center gap-3">
              {LEGEND.map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-2 rounded-full", STATUS_DOT_CLASS[item])} aria-hidden />
                  {STATUS_DOT_LABEL[item]}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <Skeleton key={index} className="h-52 rounded-xl" />
              ))}
            </div>
          ) : (
            <div>
              {/* Mobile: one month at a time */}
              <div className="space-y-3 md:hidden">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Previous month"
                    onClick={() => setMobileMonth((value) => (value + 11) % 12)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Select
                    value={String(mobileMonth)}
                    onValueChange={(value) => setMobileMonth(Number(value))}
                  >
                    <SelectTrigger className="flex-1" aria-label="Month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((name, index) => (
                        <SelectItem key={name} value={String(index)}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Next month"
                    onClick={() => setMobileMonth((value) => (value + 1) % 12)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <MonthGrid {...monthProps(mobileMonth)} />
              </div>

              {/* Desktop: 4 x 3 yearly planner */}
              <div className="hidden gap-3 md:grid md:grid-cols-3 xl:grid-cols-4">
                {MONTH_NAMES.map((name, index) => (
                  <MonthGrid key={name} {...monthProps(index)} />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {permissions.approve && (selectedSummary?.entries.length ?? 0) > 0 ? (
              <Button className="w-full" variant="outline" onClick={bulkApprove}>
                <Check className="size-4" /> Approve all on this day
              </Button>
            ) : null}
            <DayDetailPanel
              dateKey={selected}
              summary={selectedSummary}
              currency={currency}
              timeFormat={timeFormat}
              standard={standard}
              nameFor={nameFor}
              canApprove={permissions.approve}
              canEdit={canEditEntry}
              onApprove={(entry) => runAction(entry, "approve")}
              onReject={(entry) => setRejectingEntry(entry)}
              onEdit={(entry) => {
                setEditing(entry);
                setDialogOpen(true);
              }}
              isLoading={isLoading}
            />
          </div>
        </div>

        <EntryDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
          entry={editing}
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
    </TooltipProvider>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: "clock" | "coins";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icon === "clock" ? (
          <Clock className="size-4 text-primary" aria-hidden />
        ) : icon === "coins" ? (
          <Coins className="size-4 text-primary" aria-hidden />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
