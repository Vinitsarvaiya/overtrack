import { createFileRoute } from "@tanstack/react-router";
import { MembersPage } from "@/features/members/components/members-page";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({
    meta: [
      { title: "Members | OverTrack" },
      { name: "description", content: "Manage who can view, edit, and approve timesheets." },
      { property: "og:title", content: "Members | OverTrack" },
      { property: "og:description", content: "Manage who can view, edit, and approve timesheets." },
    ],
  }),
  component: MembersPage,
});
