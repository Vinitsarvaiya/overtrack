import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, CalendarClock, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OverTrack — Team overtime tracking that adds up" },
      {
        name: "description",
        content:
          "Log daily overtime, approve timesheets and export monthly reports. Built for teams that need accurate hours, not spreadsheets.",
      },
      { property: "og:title", content: "OverTrack — Team overtime tracking that adds up" },
      {
        property: "og:description",
        content:
          "Log daily overtime, approve timesheets and export monthly reports. Built for teams that need accurate hours, not spreadsheets.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: CalendarClock,
    title: "Automatic calculations",
    body: "Start, end and break in — worked hours, overtime and monthly totals out, rounded to two decimals.",
  },
  {
    icon: Users,
    title: "Shared workspaces",
    body: "Owner, admin, member and viewer roles decide who can edit, approve and export.",
  },
  {
    icon: BarChart3,
    title: "Reports that ship",
    body: "Monthly progress, category split and a printable timesheet with CSV export.",
  },
  {
    icon: ShieldCheck,
    title: "Approvals built in",
    body: "Every entry is pending, approved or rejected — with a clear audit of who logged what.",
  },
];

function Landing() {
  return (
    <main>
      <section className="grid-glow border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-28 text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" /> OverTrack
          </span>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
            Overtime tracking your team will actually keep up with
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">
            Log a day in ten seconds. See the month at a glance. Export the timesheet when payroll
            asks.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Start tracking <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-20 sm:grid-cols-2">
        {features.map((feature) => (
          <article key={feature.title} className="panel p-6">
            <feature.icon className="size-5 text-primary" />
            <h2 className="mt-4 text-base font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
          </article>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        OverTrack — overtime, accounted for.
      </footer>
    </main>
  );
}
