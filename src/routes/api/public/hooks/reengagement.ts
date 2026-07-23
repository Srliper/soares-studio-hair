import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@/lib/webhook-auth.server";

export const Route = createFileRoute("/api/public/hooks/reengagement")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyWebhookRequest(request))) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runReengagementJob } = await import("@/lib/reengagement-job.server");
          const result = await runReengagementJob();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[reengagement] job failed", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
    },
  },
});