import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores");
}

export const getReviewSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("review_settings").select("*").eq("id", 1).single();
    if (error) throw new Error(error.message);
    return data;
  });

export const saveReviewSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as {
      enabled: boolean;
      hours_after: number;
      cooldown_days: number;
      google_review_url: string;
      message_template: string;
    };
    if (typeof i.enabled !== "boolean") throw new Error("enabled inválido");
    if (!Number.isFinite(i.hours_after) || i.hours_after < 1 || i.hours_after > 168)
      throw new Error("hours_after entre 1 e 168");
    if (!Number.isFinite(i.cooldown_days) || i.cooldown_days < 1 || i.cooldown_days > 365)
      throw new Error("cooldown_days entre 1 e 365");
    if (typeof i.google_review_url !== "string" || !/^https?:\/\//i.test(i.google_review_url))
      throw new Error("URL de avaliação inválida");
    if (typeof i.message_template !== "string" || i.message_template.trim().length < 5 || i.message_template.length > 1000)
      throw new Error("mensagem inválida");
    return i;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("review_settings").update({
      enabled: data.enabled,
      hours_after: data.hours_after,
      cooldown_days: data.cooldown_days,
      google_review_url: data.google_review_url,
      message_template: data.message_template,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runReviewNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runReviewJob } = await import("./review-job.server");
    return runReviewJob({ force: true });
  });

export const listReviewEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("review_events")
      .select("id, sent_at, status, message, webhook_response, appointment:appointments(client_name, client_phone, end_at)")
      .order("sent_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });