import { createFileRoute } from "@tanstack/react-router";
import { TimesheetPage } from "@/features/timesheet/components/timesheet-page";

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
