import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, FileSpreadsheet, ShieldCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

const PAGE_TITLE = "Overtime Manager | Overtime Approval and Team Reporting";
const PAGE_DESCRIPTION =
  "Use OverTrack as an overtime manager tool to review employee overtime, approve timesheets, manage roles, and monitor monthly team reports.";

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What does an overtime manager tool do?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An overtime manager tool helps teams review overtime entries, approve or reject records, manage employee access, and prepare monthly reports.",
      },
    },
    {
      "@type": "Question",
      name: "Can OverTrack be used by managers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. OverTrack supports manager and admin workflows for approvals, reporting, and team access control.",
      },
    },
    {
      "@type": "Question",
      name: "Can OverTrack help with team overtime reports?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. OverTrack is designed to help managers and operations teams review monthly overtime totals and export timesheet reports.",
      },
    },
  ],
};

export const Route = createFileRoute("/overtime-manager")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://overtrack.publicvm.com/overtime-manager" }],
  }),
  component: OvertimeManagerPage,
});

function OvertimeManagerPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <section className="grid-glow border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-24">
          <p className="text-sm uppercase tracking-[0.18em] text-primary">Overtime Manager</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl">
            Manage overtime approvals, team access, and monthly reporting
          </h1>
          <p className="mt-6 max-w-3xl text-base text-muted-foreground sm:text-lg">
            OverTrack helps managers review overtime records, approve timesheets, organize employee
            access, and keep monthly overtime reporting easier to manage.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Open OverTrack <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/overtime-tracker">See tracking features</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-16 sm:grid-cols-2">
        <article className="panel p-6">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="mt-4 text-base font-semibold">Approval workflow</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Review pending overtime entries and decide whether they should be approved, rejected,
            or updated before reporting.
          </p>
        </article>
        <article className="panel p-6">
          <Users className="size-5 text-primary" />
          <h2 className="mt-4 text-base font-semibold">Role-based access</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Control who can edit entries, approve timesheets, or export reports inside the team
            workspace.
          </p>
        </article>
        <article className="panel p-6">
          <BarChart3 className="size-5 text-primary" />
          <h2 className="mt-4 text-base font-semibold">Monthly team reporting</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Track overtime totals, review patterns, and prepare a clearer monthly picture for
            operations and payroll.
          </p>
        </article>
        <article className="panel p-6">
          <FileSpreadsheet className="size-5 text-primary" />
          <h2 className="mt-4 text-base font-semibold">Export-ready records</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep reports ready for finance, HR, payroll, and internal audit workflows.
          </p>
        </article>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="panel p-8">
          <h2 className="text-2xl font-semibold">Who searches for an overtime manager solution?</h2>
          <div className="mt-6 space-y-4 text-sm text-muted-foreground">
            <p>
              Operations leads, payroll teams, HR teams, and department managers often need an
              overtime manager workflow that is easier than email threads and spreadsheets.
            </p>
            <p>
              OverTrack helps by combining overtime tracking, approval workflows, team roles, and
              reporting in one product that can be used across a shared workspace.
            </p>
            <p>
              This makes OverTrack relevant for searches around overtime manager tools, overtime
              approval software, timesheet review systems, and employee overtime reporting.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
