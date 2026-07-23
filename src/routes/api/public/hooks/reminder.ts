import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@/lib/webhook-auth.server";

export const Route = createFileRoute("/api/public/hooks/reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyWebhookRequest(request))) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const url = new URL(request.url);
          const { runReminderJob } = await import("@/lib/reminder-job.server");
          const result = await runReminderJob({ baseUrl: `${url.protocol}//${url.host}` });
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[reminder] job failed", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
    },
  },
});