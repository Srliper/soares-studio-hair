import { createClient } from "@supabase/supabase-js";

type Settings = {
  enabled: boolean;
  hours_before: number;
  message_template: string;
};

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function render(tpl: string, ctx: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => ctx[k] ?? "");
}

export async function runReminderJob(opts: { force?: boolean; baseUrl?: string } = {}) {
  const sb = admin();
  const { data: settings, error: sErr } = await sb
    .from("reminder_settings").select("*").eq("id", 1).single();
  if (sErr) throw new Error(sErr.message);
  const s = settings as Settings;
  if (!s.enabled && !opts.force) return { skipped: true, reason: "disabled", processed: 0, sent: 0 };

  const now = Date.now();
  const windowStart = new Date(now + (s.hours_before - 1) * 3600_000).toISOString();
  const windowEnd = new Date(now + (s.hours_before + 1) * 3600_000).toISOString();

  const { data: rows, error } = await sb
    .from("appointments")
    .select("id, manage_token, client_name, client_phone, start_at, reminder_sent_at, status, professionals(name), services(name)")
    .gte("start_at", windowStart)
    .lte("start_at", windowEnd)
    .in("status", ["pendente", "confirmado"])
    .is("reminder_sent_at", null)
    .limit(100);
  if (error) throw new Error(error.message);

  const webhook = process.env.N8N_REMINDER_WEBHOOK_URL || process.env.N8N_REENGAGEMENT_WEBHOOK_URL;
  const baseUrl = opts.baseUrl || process.env.PUBLIC_APP_URL || "";
  const out = { processed: 0, sent: 0, failed: 0 };

  for (const a of rows ?? []) {
    out.processed++;
    const first = (a.client_name || "").split(" ")[0] || a.client_name || "";
    const when = new Date(a.start_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const manageLink = baseUrl ? `${baseUrl}/agendamento/${a.manage_token}` : `/agendamento/${a.manage_token}`;
    const message = render(s.message_template, {
      name: first, fullname: a.client_name, when,
      professional: (a as any).professionals?.name ?? "",
      service: (a as any).services?.name ?? "",
      manage_link: manageLink,
    });

    let status = "sent";
    if (!webhook) {
      status = "dry_run";
    } else {
      try {
        const res = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "reminder",
            appointment_id: a.id,
            name: a.client_name, phone: a.client_phone,
            start_at: a.start_at, message, manage_link: manageLink,
          }),
        });
        if (!res.ok) status = `error_${res.status}`;
      } catch (e: any) {
        status = "network_error";
      }
    }
    await sb.from("appointments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", a.id);
    if (status === "sent" || status === "dry_run") out.sent++; else out.failed++;
  }
  return out;
}