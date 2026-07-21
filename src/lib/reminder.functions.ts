import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores");
}

export const getReminderSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("reminder_settings").select("*").eq("id", 1).single();
    if (error) throw new Error(error.message);
    return data;
  });

export const saveReminderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { enabled: boolean; hours_before: number; message_template: string };
    if (typeof i.enabled !== "boolean") throw new Error("enabled inválido");
    if (!Number.isFinite(i.hours_before) || i.hours_before < 1 || i.hours_before > 168)
      throw new Error("hours_before entre 1 e 168");
    if (typeof i.message_template !== "string" || i.message_template.trim().length < 5 || i.message_template.length > 1000)
      throw new Error("mensagem inválida");
    return i;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("reminder_settings")
      .update({ enabled: data.enabled, hours_before: data.hours_before, message_template: data.message_template, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runReminderNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runReminderJob } = await import("./reminder-job.server");
    return runReminderJob({ force: true });
  });