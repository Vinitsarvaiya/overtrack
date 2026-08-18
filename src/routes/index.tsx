import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, CalendarClock, ShieldCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

const HOME_TITLE = "OverTrack | Team Overtime Tracking Software";
const HOME_DESCRIPTION =
  "OverTrack helps teams track overtime, approve timesheets, manage member roles, and export monthly reports in one workspace.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESCRIPTION },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://overtrack.publicvm.com/" }],
  }),
  component: Landing,
});

const features = [
  {
    icon: CalendarClock,
    title: "Automatic calculations",
    body: "Start, end, and break in. Worked hours, overtime, and monthly totals out, rounded to two decimals.",
  },
  {
    icon: Users,
    title: "Shared workspaces",
    body: "Owner, admin, member, and viewer roles decide who can edit, approve, and export.",
  },
  {
    icon: BarChart3,
    title: "Reports that ship",
    body: "Monthly progress, category split, and printable timesheets with CSV exports.",
  },
  {
    icon: ShieldCheck,
    title: "Approvals built in",
    body: "Every entry is pending, approved, or rejected with a clear audit of who logged what.",
  },
];

function Landing() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "OverTrack",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://overtrack.publicvm.com/",
    description: HOME_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Overtime tracking",
      "Timesheet approvals",
      "Monthly reporting",
      "Team role management",
      "Shared workspaces",
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="grid-glow border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-28 text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" /> OverTrack
          </span>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
            Overtime tracking your team will actually keep up with
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">
            Log a day in ten seconds. Review approvals. Export the monthly timesheet when payroll
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
        OverTrack | overtime, accounted for.
      </footer>
    </main>
  );
}
