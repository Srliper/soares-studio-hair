import { createClient } from "@supabase/supabase-js";

type Settings = {
  enabled: boolean;
  days_threshold: number;
  cooldown_days: number;
  message_template: string;
};

function admin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function renderTemplate(tpl: string, ctx: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => ctx[k] ?? "");
}

export async function runReengagementJob(opts: { force?: boolean } = {}) {
  const sb = admin();

  const { data: settings, error: sErr } = await sb
    .from("reengagement_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (sErr) throw new Error(sErr.message);
  const s = settings as Settings;

  if (!s.enabled && !opts.force) {
    return { skipped: true, reason: "disabled", processed: 0, sent: 0, failed: 0 };
  }

  const thresholdIso = new Date(Date.now() - s.days_threshold * 86400 * 1000).toISOString();
  const cooldownIso = new Date(Date.now() - s.cooldown_days * 86400 * 1000).toISOString();

  // Candidates: not opted out, last visit before threshold, no recent event
  const { data: candidates, error: cErr } = await sb
    .from("customers")
    .select("id, name, phone_digits, phone_display, last_visit_at")
    .eq("opted_out", false)
    .lte("last_visit_at", thresholdIso)
    .limit(200);
  if (cErr) throw new Error(cErr.message);

  const webhookUrl = process.env.N8N_REENGAGEMENT_WEBHOOK_URL;
  const results = { processed: 0, sent: 0, failed: 0, skipped_cooldown: 0 };

  for (const c of candidates ?? []) {
    results.processed++;

    // Cooldown check
    const { data: recent } = await sb
      .from("reengagement_events")
      .select("id")
      .eq("customer_id", c.id)
      .gte("sent_at", cooldownIso)
      .limit(1);
    if (recent && recent.length > 0) {
      results.skipped_cooldown++;
      continue;
    }

    const message = renderTemplate(s.message_template, {
      name: c.name.split(" ")[0] ?? c.name,
      fullname: c.name,
    });

    let status = "sent";
    let response = "";

    if (!webhookUrl) {
      status = "dry_run";
      response = "N8N_REENGAGEMENT_WEBHOOK_URL não configurado";
    } else {
      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_id: c.id,
            name: c.name,
            phone: c.phone_digits,
            phone_display: c.phone_display,
            last_visit_at: c.last_visit_at,
            message,
            source: "studio-soares-reengagement",
          }),
        });
        response = (await res.text()).slice(0, 500);
        if (!res.ok) status = `error_${res.status}`;
      } catch (e: any) {
        status = "network_error";
        response = String(e?.message ?? e).slice(0, 500);
      }
    }

    await sb.from("reengagement_events").insert({
      customer_id: c.id,
      status,
      message,
      webhook_response: response,
      channel: webhookUrl ? "n8n" : "dry_run",
    });

    if (status === "sent" || status === "dry_run") results.sent++;
    else results.failed++;
  }

  return results;
}