import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/features/auth/components/auth-page";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — OverTrack" },
      {
        name: "description",
        content: "Sign in or create your OverTrack account to track overtime with your team.",
      },
      { property: "og:title", content: "Sign in — OverTrack" },
      {
        property: "og:description",
        content: "Sign in or create your OverTrack account to track overtime with your team.",
      },
    ],
  }),
  component: AuthPage,
});
