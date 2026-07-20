import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content:
    "Olá! Sou a atendente virtual do **Studio Soares**. Posso te ajudar a escolher um serviço, tirar dúvidas sobre horários ou preços. O que você procura hoje?",
};

export function AIChatFloat() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) return null;

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const errText = (await res.text().catch(() => "")) || "Não consegui responder agora. Fale no WhatsApp.";
        setMessages([...next, { role: "assistant", content: errText }]);
        return;
      }

      // Adiciona bolha vazia e vai preenchendo enquanto os tokens chegam
      setMessages([...next, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
      if (!acc) {
        setMessages([
          ...next,
          { role: "assistant", content: "Não consegui responder agora. Fale no WhatsApp." },
        ]);
      }
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Falha de conexão. Tente novamente em instantes." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[520px] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-white/10 bg-background/95 shadow-2xl backdrop-blur sm:bottom-28 sm:right-24">
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-primary/20 to-primary/5 px-4 py-3">
            <div>
              <div className="font-display text-base text-primary">Studio Soares</div>
              <div className="text-[11px] text-muted-foreground">Atendente virtual · online</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar chat"
              className="rounded-full p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[85%] rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 text-sm text-foreground/90"
                  }
                >
                  <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Pensando...
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-white/10 bg-background/80 px-3 py-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escreva sua mensagem..."
              disabled={loading}
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Floating button — left of the WhatsApp button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar chat" : "Abrir chat"}
        className="fixed bottom-5 right-24 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_rgba(212,175,55,0.6)] ring-1 ring-white/10 transition-transform hover:scale-110 sm:bottom-5 sm:right-28 sm:h-16 sm:w-16"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7" />}
      </button>
    </>
  );
}