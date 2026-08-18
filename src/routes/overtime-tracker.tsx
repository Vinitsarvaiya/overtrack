import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, CheckCircle2, FileSpreadsheet, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

const PAGE_TITLE = "Overtime Tracker | Employee Overtime Tracking Software";
const PAGE_DESCRIPTION =
  "Use OverTrack as an overtime tracker for employees and teams. Track overtime hours, review timesheets, approve entries, and export monthly reports.";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: PAGE_TITLE,
  url: "https://overtrack.publicvm.com/overtime-tracker",
  description: PAGE_DESCRIPTION,
  about: [
    "overtime tracker",
    "employee overtime tracking",
    "overtime timesheet software",
    "monthly overtime reports",
  ],
};

const sections = [
  {
    icon: CalendarClock,
    title: "Track overtime every day",
    body: "Log start time, end time, break minutes, and extra working hours in one daily entry flow.",
  },
  {
    icon: CheckCircle2,
    title: "Review and approve entries",
    body: "Managers can review pending overtime records before they become part of the monthly report.",
  },
  {
    icon: FileSpreadsheet,
    title: "Prepare payroll exports",
    body: "Use monthly summaries and timesheet exports to support payroll, HR, and operations workflows.",
  },
  {
    icon: Users,
    title: "Manage teams in one workspace",
    body: "Shared workspaces make it easier to keep employee overtime records organized across a team.",
  },
];

export const Route = createFileRoute("/overtime-tracker")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://overtrack.publicvm.com/overtime-tracker" }],
  }),
  component: OvertimeTrackerPage,
});

function OvertimeTrackerPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="grid-glow border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-24">
          <p className="text-sm uppercase tracking-[0.18em] text-primary">Overtime Tracker</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl">
            Employee overtime tracking software built for teams
          </h1>
          <p className="mt-6 max-w-3xl text-base text-muted-foreground sm:text-lg">
            OverTrack works as an overtime tracker for businesses that need accurate employee
            overtime logs, team approvals, and monthly timesheet exports in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Start tracking overtime <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/about">Learn more</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((item) => (
            <article key={item.title} className="panel p-6">
              <item.icon className="size-5 text-primary" />
              <h2 className="mt-4 text-base font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="panel p-8">
          <h2 className="text-2xl font-semibold">Why teams search for an overtime tracker</h2>
          <div className="mt-6 space-y-4 text-sm text-muted-foreground">
            <p>
              Many businesses start with spreadsheets for overtime tracking, but those sheets often
              become difficult to review, approve, and audit across multiple employees.
            </p>
            <p>
              OverTrack gives teams a more structured overtime tracking workflow with daily entries,
              role-based access, manager approvals, and monthly summaries that are easier to review.
            </p>
            <p>
              If your team needs an employee overtime tracker, an overtime report system, or a
              timesheet approval workflow, this page helps explain how OverTrack fits that use
              case.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
