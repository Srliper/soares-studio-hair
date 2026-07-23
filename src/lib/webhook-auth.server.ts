import { createClient } from "@supabase/supabase-js";

let cachedSecret: string | null = null;
let cachedAt = 0;

async function loadSecret(): Promise<string | null> {
  const now = Date.now();
  if (cachedSecret && now - cachedAt < 60_000) return cachedSecret;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await sb.from("webhook_config").select("secret").eq("id", true).maybeSingle();
  const secret = (data as { secret?: string } | null)?.secret ?? null;
  if (secret) {
    cachedSecret = secret;
    cachedAt = now;
  }
  return secret;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyWebhookRequest(request: Request): Promise<boolean> {
  const provided = request.headers.get("x-webhook-secret");
  if (!provided) return false;
  const expected = await loadSecret();
  if (!expected) return false;
  return timingSafeEqual(provided, expected);
}