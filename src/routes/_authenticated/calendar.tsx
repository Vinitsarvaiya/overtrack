import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/features/calendar/components/calendar-page";

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
