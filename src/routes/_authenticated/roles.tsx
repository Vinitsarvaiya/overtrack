import { createFileRoute } from "@tanstack/react-router";
import { RolesPage } from "@/features/roles/components/roles-page";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({
    meta: [
      { title: "Role Management — OverTrack" },
      {
        name: "description",
        content: "Create manager roles and switch individual permissions on or off.",
      },
      { property: "og:title", content: "Role Management — OverTrack" },
      {
        property: "og:description",
        content: "Create manager roles and switch individual permissions on or off.",
      },
    ],
  }),
  component: RolesPage,
});
