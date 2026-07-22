import { createClient } from "@supabase/supabase-js";

type Settings = {
  enabled: boolean;
  hours_after: number;
  cooldown_days: number;
  google_review_url: string;
  message_template: string;
};

function admin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function render(tpl: string, ctx: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => ctx[k] ?? "");
}

export async function runReviewJob(opts: { force?: boolean } = {}) {
  const sb = admin();

  const { data: settings, error: sErr } = await sb
    .from("review_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (sErr) throw new Error(sErr.message);
  const s = settings as Settings;

  if (!s.enabled && !opts.force) {
    return { skipped: true, reason: "disabled", processed: 0, sent: 0, failed: 0, skipped_cooldown: 0 };
  }

  // Window: appointments that ended between (hours_after) and (hours_after + 24h) ago.
  const now = Date.now();
  const upper = new Date(now - s.hours_after * 3600_000).toISOString();
  const lower = new Date(now - (s.hours_after + 24) * 3600_000).toISOString();
  const cooldownIso = new Date(now - s.cooldown_days * 86400_000).toISOString();

  const { data: appts, error: aErr } = await sb
    .from("appointments")
    .select("id, client_name, client_phone, start_at, end_at, status, professional_id, service_id, professionals(name), services(name)")
    .in("status", ["confirmado", "concluido"])
    .gte("end_at", lower)
    .lte("end_at", upper)
    .limit(200);
  if (aErr) throw new Error(aErr.message);

  const webhookUrl =
    process.env.N8N_REVIEW_WEBHOOK_URL || process.env.N8N_REENGAGEMENT_WEBHOOK_URL;
  const results = { processed: 0, sent: 0, failed: 0, skipped_cooldown: 0, skipped_sent: 0 };

  for (const a of appts ?? []) {
    results.processed++;

    // Skip if this appointment was already processed
    const { data: existing } = await sb
      .from("review_events")
      .select("id")
      .eq("appointment_id", a.id)
      .limit(1);
    if (existing && existing.length > 0) {
      results.skipped_sent++;
      continue;
    }

    const digits = (a.client_phone ?? "").replace(/\D/g, "");
    if (!digits) {
      results.failed++;
      continue;
    }

    // Look up customer for cooldown + opt-out
    const { data: cust } = await sb
      .from("customers")
      .select("id, opted_out")
      .eq("phone_digits", digits)
      .maybeSingle();

    if (cust?.opted_out) {
      results.skipped_cooldown++;
      continue;
    }

    if (cust?.id) {
      const { data: recent } = await sb
        .from("review_events")
        .select("id")
        .eq("customer_id", cust.id)
        .gte("sent_at", cooldownIso)
        .limit(1);
      if (recent && recent.length > 0) {
        results.skipped_cooldown++;
        continue;
      }
    }

    const message = render(s.message_template, {
      name: (a.client_name ?? "").split(" ")[0] ?? a.client_name ?? "",
      fullname: a.client_name ?? "",
      url: s.google_review_url,
      professional: (a as any).professionals?.name ?? "",
      service: (a as any).services?.name ?? "",
    });

    let status = "sent";
    let response = "";
    if (!webhookUrl) {
      status = "dry_run";
      response = "N8N_REVIEW_WEBHOOK_URL não configurado";
    } else {
      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "review_request",
            appointment_id: a.id,
            customer_id: cust?.id ?? null,
            name: a.client_name,
            phone: digits,
            phone_display: a.client_phone,
            professional: (a as any).professionals?.name ?? "",
            service: (a as any).services?.name ?? "",
            end_at: a.end_at,
            review_url: s.google_review_url,
            message,
            source: "studio-soares-review",
          }),
        });
        response = (await res.text()).slice(0, 500);
        if (!res.ok) status = `error_${res.status}`;
      } catch (e: any) {
        status = "network_error";
        response = String(e?.message ?? e).slice(0, 500);
      }
    }

    await sb.from("review_events").insert({
      appointment_id: a.id,
      customer_id: cust?.id ?? null,
      status,
      message,
      channel: webhookUrl ? "n8n" : "dry_run",
      webhook_response: response,
    });

    if (status === "sent" || status === "dry_run") results.sent++;
    else results.failed++;
  }

  return results;
}