import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/features/settings/components/settings-page";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — OverTrack" },
      {
        name: "description",
        content:
          "Configure standard working hours, breaks, approvals, holidays and custom working days for your workspace.",
      },
      { property: "og:title", content: "Settings — OverTrack" },
      {
        property: "og:description",
        content:
          "Configure standard working hours, breaks, approvals, holidays and custom working days for your workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});
