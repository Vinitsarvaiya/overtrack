import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        const payload = {
          status: "ok",
          service: "overtrack",
          timestamp: new Date().toISOString(),
        };

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
