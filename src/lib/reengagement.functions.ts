import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores");
}

export const getReengagementSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("reengagement_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

export const saveReengagementSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as {
      enabled: boolean;
      days_threshold: number;
      cooldown_days: number;
      message_template: string;
    };
    if (typeof i.enabled !== "boolean") throw new Error("enabled inválido");
    if (!Number.isFinite(i.days_threshold) || i.days_threshold < 7 || i.days_threshold > 365)
      throw new Error("days_threshold entre 7 e 365");
    if (!Number.isFinite(i.cooldown_days) || i.cooldown_days < 7 || i.cooldown_days > 365)
      throw new Error("cooldown_days entre 7 e 365");
    if (typeof i.message_template !== "string" || i.message_template.trim().length < 5 || i.message_template.length > 1000)
      throw new Error("mensagem inválida");
    return i;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("reengagement_settings")
      .update({
        enabled: data.enabled,
        days_threshold: data.days_threshold,
        cooldown_days: data.cooldown_days,
        message_template: data.message_template,
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runReengagementNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runReengagementJob } = await import("./reengagement-job.server");
    return runReengagementJob({ force: true });
  });

export const listReengagementEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("reengagement_events")
      .select("id, sent_at, status, message, webhook_response, customer:customers(name, phone_display)")
      .order("sent_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });