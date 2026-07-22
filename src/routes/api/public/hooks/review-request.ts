import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/review-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runReviewJob } = await import("@/lib/review-job.server");
          const result = await runReviewJob();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[review-request] job failed", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
    },
  },
});