import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type ChatMessage = { role: "user" | "assistant"; content: string };

async function loadContext() {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return "";
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const [{ data: pros }, { data: svcs }] = await Promise.all([
      sb.from("professionals_public").select("id,name,role_title"),
      sb.from("services").select("name,duration_minutes,price_cents,professional_id,active"),
    ]);
    const lines: string[] = [];
    for (const p of pros ?? []) {
      lines.push(`- ${p.name} (${p.role_title ?? "profissional"}):`);
      for (const s of (svcs ?? []).filter((x) => x.professional_id === p.id && x.active)) {
        const price = s.price_cents ? `R$ ${(s.price_cents / 100).toFixed(2)}` : "sob consulta";
        lines.push(`   • ${s.name} — ${s.duration_minutes ?? "?"} min — ${price}`);
      }
    }
    return lines.join("\n");
  } catch {
    return "";
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as { messages?: ChatMessage[] };
        const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
        if (messages.length === 0) return new Response("messages required", { status: 400 });

        const catalog = await loadContext();

        const system = `Você é a atendente virtual do Studio Soares Hair, salão de beleza em São Miguel Arcanjo, SP.

Dados do estúdio:
- Profissionais: Afonso Soares (cortes masculinos, femininos, mechas, casamentos) e Alexia Soares (manicure, unhas, noivas)
- Endereço: R. Cel. Fernando Prestes, 622 - Centro, São Miguel Arcanjo, SP
- Horário: Terça a Sábado, 09:00–19:00
- WhatsApp: +55 15 99834-3669

Catálogo atual de serviços e preços:
${catalog || "(catálogo indisponível no momento — sugira falar no WhatsApp para valores)"}

Como atender:
- Seja cordial, breve e em português brasileiro. Trate por você.
- Ajude o cliente a escolher serviço e profissional certos.
- Ao final, sempre convide para agendar clicando em "Agendar" no site ou chamar no WhatsApp.
- NUNCA invente preços, horários ou serviços fora do catálogo acima. Se não souber, diga que confirma no WhatsApp.
- Respostas curtas (máx 3-4 frases), use listas quando útil.`;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": key,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "system", content: system }, ...messages],
            stream: true,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          if (res.status === 429) return new Response("Muitas mensagens agora. Tente em instantes.", { status: 429 });
          if (res.status === 402) return new Response("Créditos de IA esgotados. Fale no WhatsApp.", { status: 402 });
          return new Response(text || "Erro na IA", { status: 500 });
        }

        if (!res.body) return new Response("Empty stream", { status: 500 });

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            const encoder = new TextEncoder();
            let buffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let idx: number;
                while ((idx = buffer.indexOf("\n")) !== -1) {
                  const line = buffer.slice(0, idx).trim();
                  buffer = buffer.slice(idx + 1);
                  if (!line.startsWith("data:")) continue;
                  const payload = line.slice(5).trim();
                  if (payload === "[DONE]") continue;
                  try {
                    const json = JSON.parse(payload) as {
                      choices?: { delta?: { content?: string } }[];
                    };
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) controller.enqueue(encoder.encode(delta));
                  } catch {
                    /* skip malformed chunk */
                  }
                }
              }
            } catch (e) {
              controller.error(e);
              return;
            }
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});