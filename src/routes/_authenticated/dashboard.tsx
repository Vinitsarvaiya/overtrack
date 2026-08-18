import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Clock, Flame, Gauge, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntries, useWorkspaceMembers } from "@/lib/data";
import { useWorkspace } from "@/components/workspace-provider";
import { baseStandardHours } from "@/lib/working-calendar";
import { STATUS_LABELS, formatHours, overtimeHours, round2, workedHours } from "@/lib/overtime";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — OverTrack" },
      {
        name: "description",
        content: "Overtime totals, monthly progress and recent entries for your workspace.",
      },
      { property: "og:title", content: "Dashboard — OverTrack" },
      {
        property: "og:description",
        content: "Overtime totals, monthly progress and recent entries for your workspace.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { workspace, loading } = useWorkspace();
  const { data: entries = [], isLoading } = useEntries(workspace?.id);
  const { data: members = [] } = useWorkspaceMembers(workspace?.id);
  const standard = baseStandardHours(workspace);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const stats = useMemo(() => {
    const month = today.slice(0, 7);
    const monthEntries = entries.filter((entry) => entry.entry_date.startsWith(month));
    const monthHours = round2(monthEntries.reduce((sum, e) => sum + workedHours(e), 0));
    const monthOvertime = round2(
      monthEntries.reduce((sum, e) => sum + overtimeHours(e, standard), 0),
    );
    const days = new Set(monthEntries.map((entry) => entry.entry_date)).size;
    const longest = entries.reduce(
      (best, entry) => (workedHours(entry) > workedHours(best ?? entry) ? entry : best),
      entries[0] ?? null,
    );
    return {
      todayOvertime: round2(
        entries
          .filter((entry) => entry.entry_date === today)
          .reduce((sum, e) => sum + overtimeHours(e, standard), 0),
      ),
      monthHours,
      monthOvertime,
      days,
      average: days ? round2(monthHours / days) : 0,
      longest,
    };
  }, [entries, standard, today]);

  const daily = useMemo(() => {
    const month = today.slice(0, 7);
    const map = new Map<string, number>();
    entries
      .filter((entry) => entry.entry_date.startsWith(month))
      .forEach((entry) => {
        map.set(entry.entry_date, (map.get(entry.entry_date) ?? 0) + overtimeHours(entry, standard));
      });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, hours]) => ({ day: date.slice(8), hours: round2(hours) }));
  }, [entries, standard, today]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((entry) => {
      map.set(entry.category, round2((map.get(entry.category) ?? 0) + workedHours(entry)));
    });
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [entries]);

  if (loading || isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  const chartColors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {workspace?.name} · standard day {standard}h
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Clock}
          label="Today's overtime"
          value={formatHours(stats.todayOvertime)}
        />
        <StatCard icon={TrendingUp} label="This month hours" value={formatHours(stats.monthHours)} />
        <StatCard
          icon={CalendarDays}
          label="Days worked this month"
          value={String(stats.days)}
        />
        <StatCard icon={Gauge} label="Average daily hours" value={formatHours(stats.average)} />
        <StatCard
          icon={Flame}
          label="Longest day"
          value={stats.longest ? formatHours(workedHours(stats.longest)) : "—"}
          hint={stats.longest?.entry_date}
        />
        <StatCard icon={Users} label="Total members" value={String(members.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Monthly overtime progress</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {daily.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      color: "var(--color-popover-foreground)",
                    }}
                  />
                  <Bar dataKey="hours" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {byCategory.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                    {byCategory.map((slice, index) => (
                      <Cell key={slice.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      color: "var(--color-popover-foreground)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries.slice(0, 6).map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium">{entry.entry_date}</span>
                <Badge variant="secondary">{entry.category}</Badge>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>{formatHours(workedHours(entry))} worked</span>
                <span className="text-primary">
                  +{formatHours(overtimeHours(entry, standard))}
                </span>
                <Badge variant={entry.status === "approved" ? "default" : "outline"}>
                  {STATUS_LABELS[entry.status] ?? entry.status}
                </Badge>
              </div>
            </div>
          ))}
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No entries yet — use “Log time” to add your first one.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-6">
        <span className="flex size-9 items-center justify-center rounded-md bg-accent text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Not enough data yet
    </div>
  );
}
