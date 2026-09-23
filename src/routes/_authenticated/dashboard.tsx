import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/features/dashboard/components/dashboard-page";

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
