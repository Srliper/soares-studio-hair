import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhookRequest } from "@/lib/webhook-auth.server";

export const Route = createFileRoute("/api/public/hooks/waitlist-slot-freed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyWebhookRequest(request))) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const body = (await request.json().catch(() => ({}))) as { appointment_id?: string };
          if (!body.appointment_id) {
            return Response.json({ ok: false, error: "appointment_id required" }, { status: 400 });
          }
          const sb = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } }
          );

          const { data: apt, error: aErr } = await sb
            .from("appointments")
            .select("id, professional_id, service_id, start_at, professionals(name), services(name)")
            .eq("id", body.appointment_id)
            .single();
          if (aErr || !apt) throw new Error(aErr?.message ?? "appointment not found");

          const dateStr = new Date(apt.start_at).toISOString().slice(0, 10);
          const { data: matches, error: mErr } = await sb
            .from("waitlist")
            .select("id, client_name, client_phone, desired_date")
            .eq("professional_id", apt.professional_id)
            .eq("service_id", apt.service_id)
            .eq("status", "aguardando")
            .eq("desired_date", dateStr)
            .order("created_at", { ascending: true })
            .limit(20);
          if (mErr) throw new Error(mErr.message);

          const webhook =
            process.env.N8N_WAITLIST_WEBHOOK_URL ||
            process.env.N8N_REMINDER_WEBHOOK_URL ||
            process.env.N8N_REENGAGEMENT_WEBHOOK_URL;
          const url = new URL(request.url);
          const baseUrl = `${url.protocol}//${url.host}`;
          const when = new Date(apt.start_at).toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          });
          const professionalName = (apt as any).professionals?.name ?? "";
          const serviceName = (apt as any).services?.name ?? "";

          let notified = 0;
          for (const w of matches ?? []) {
            const message =
              `Olá ${w.client_name.split(" ")[0]}! Um horário abriu com ${professionalName} ` +
              `para ${serviceName} em ${when}. Reserve rápido: ${baseUrl}`;
            if (webhook) {
              try {
                await fetch(webhook, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    kind: "waitlist_slot_freed",
                    waitlist_id: w.id,
                    name: w.client_name,
                    phone: w.client_phone,
                    professional: professionalName,
                    service: serviceName,
                    start_at: apt.start_at,
                    message,
                    booking_url: baseUrl,
                  }),
                });
              } catch (e) {
                console.error("[waitlist] webhook failed", e);
              }
            }
            await sb
              .from("waitlist")
              .update({ status: "notificado", notified_at: new Date().toISOString() })
              .eq("id", w.id);
            notified++;
          }

          return Response.json({ ok: true, notified, dry_run: !webhook });
        } catch (e: any) {
          console.error("[waitlist-slot-freed]", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
    },
  },
});