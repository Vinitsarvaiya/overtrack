import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, CalendarClock, FileSpreadsheet, ShieldCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

const ABOUT_TITLE = "About OverTrack | Overtime Tracking, Timesheets, and Team Approvals";
const ABOUT_DESCRIPTION =
  "Learn what OverTrack does, how overtime tracking works, who it is for, and how teams use it for timesheets, approvals, and monthly reporting.";

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is OverTrack?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "OverTrack is a web-based overtime tracking app for teams. It helps businesses log overtime, review timesheets, manage approvals, and export monthly reports.",
      },
    },
    {
      "@type": "Question",
      name: "Who is OverTrack for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "OverTrack is for companies, managers, HR teams, payroll teams, and employees who need a simple way to record overtime hours and review monthly working-time reports.",
      },
    },
    {
      "@type": "Question",
      name: "What can teams do with OverTrack?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Teams can track daily overtime, review approvals, manage workspace members and roles, analyze monthly totals, and export timesheets for payroll or internal reporting.",
      },
    },
    {
      "@type": "Question",
      name: "Does OverTrack support team approvals?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. OverTrack includes approval workflows so managers or admins can review overtime entries and keep a clear audit trail for each record.",
      },
    },
    {
      "@type": "Question",
      name: "Can OverTrack export overtime reports?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. OverTrack is designed to help teams export monthly reports and timesheets for payroll, audits, or internal operations.",
      },
    },
  ],
};

const highlights = [
  {
    icon: CalendarClock,
    title: "Daily overtime tracking",
    body: "Record start time, end time, break time, and daily overtime with fast entry flows.",
  },
  {
    icon: ShieldCheck,
    title: "Approval workflows",
    body: "Managers and admins can review pending entries and keep a clean approval history.",
  },
  {
    icon: Users,
    title: "Shared workspaces",
    body: "Invite teammates, assign roles, and control who can edit, approve, or export data.",
  },
  {
    icon: FileSpreadsheet,
    title: "Timesheet exports",
    body: "Prepare monthly reports and timesheet exports for payroll, finance, and compliance use.",
  },
  {
    icon: BarChart3,
    title: "Monthly reporting",
    body: "See monthly overtime totals, trends, and category breakdowns in one workspace.",
  },
];

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: ABOUT_TITLE },
      { name: "description", content: ABOUT_DESCRIPTION },
      { property: "og:title", content: ABOUT_TITLE },
      { property: "og:description", content: ABOUT_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://overtrack.publicvm.com/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <section className="grid-glow border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-24">
          <p className="text-sm uppercase tracking-[0.18em] text-primary">About OverTrack</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl">
            Overtime tracking software for teams that need clear timesheets and approvals
          </h1>
          <p className="mt-6 max-w-3xl text-base text-muted-foreground sm:text-lg">
            OverTrack is built for businesses that want a cleaner way to track overtime hours,
            review entries, manage team roles, and prepare monthly timesheet reports without
            relying on spreadsheets.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Start using OverTrack <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item) => (
            <article key={item.title} className="panel p-6">
              <item.icon className="size-5 text-primary" />
              <h2 className="mt-4 text-base font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="panel p-8">
          <h2 className="text-2xl font-semibold">What OverTrack helps teams do</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-base font-semibold">Track overtime accurately</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Teams can log working time, breaks, overtime hours, and notes for each day. This
                makes it easier to maintain accurate monthly records.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold">Review timesheets faster</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Managers can review submitted entries, approve or reject them, and keep a clear
                trail of decisions for later audits.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold">Manage teams and permissions</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                OverTrack supports shared workspaces with roles for owners, admins, members, and
                viewers, so teams can control who can access and edit overtime data.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold">Export monthly reports</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Monthly summaries and timesheet exports help payroll, HR, and operations teams
                process overtime more consistently.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="panel p-8">
          <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
          <div className="mt-8 space-y-6">
            <div>
              <h3 className="text-base font-semibold">What is OverTrack?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                OverTrack is an overtime tracking website for teams. It combines daily logging,
                approvals, member roles, and reporting in one place.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold">Is OverTrack useful for payroll teams?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Yes. OverTrack helps payroll and operations teams collect monthly overtime totals
                and export timesheet data in a more consistent format.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold">Can OverTrack help managers approve overtime?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Yes. Approval workflows make it easier for managers to review entries before they
                become part of the team record.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold">Does OverTrack support team-based access?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Yes. Teams can invite members and manage access by role, which helps protect data
                and organize workspace permissions.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
