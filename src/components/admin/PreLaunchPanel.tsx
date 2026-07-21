import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, Rocket, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type AutoCheck = {
  id: string;
  label: string;
  hint?: string;
  ok: boolean;
  detail?: string;
  action?: { to: string; label: string };
};

const MANUAL_ITEMS: { id: string; label: string; hint?: string }[] = [
  { id: "test_booking", label: "Fiz um agendamento de teste ponta-a-ponta", hint: "Escolher profissional, serviço, horário e confirmar." },
  { id: "test_whatsapp", label: "Cliquei no botão do WhatsApp e a mensagem abriu correta" },
  { id: "test_maps", label: "Verifiquei o endereço e o botão 'Como chegar' no rodapé" },
  { id: "social_links", label: "Confirmei que Instagram e TikTok abrem os perfis certos" },
  { id: "og_preview", label: "Testei a pré-visualização do link no WhatsApp/Instagram", hint: "Cole a URL num chat e veja o preview." },
  { id: "prices_reviewed", label: "Revisei preços e duração de todos os serviços" },
  { id: "reminder_message", label: "Revisei o texto do lembrete de 24h em Lembretes" },
  { id: "reengagement_message", label: "Revisei o texto de reengajamento em Reengajamento" },
  { id: "backup_admin", label: "Salvei minhas credenciais de admin em local seguro" },
];

const STORAGE_KEY = "prelaunch_checklist_v1";

export function PreLaunchPanel() {
  const [manual, setManual] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setManual(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(manual));
    } catch {}
  }, [manual]);

  const auto = useQuery({
    queryKey: ["prelaunch-auto"],
    queryFn: async (): Promise<AutoCheck[]> => {
      const [pros, services, portfolioOk, reminderCfg, reengageCfg, adminCount] = await Promise.all([
        supabase.from("professionals").select("id,name,active", { count: "exact" }).eq("active", true),
        supabase.from("services").select("id,professional_id,active", { count: "exact" }).eq("active", true),
        supabase.from("portfolio_items").select("id", { count: "exact", head: true }).eq("status", "aprovado"),
        supabase.from("reminder_settings").select("enabled,message_template").maybeSingle(),
        supabase.from("reengagement_settings").select("enabled,message_template").maybeSingle(),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin"),
      ]);

      const proList = pros.data ?? [];
      const svcList = services.data ?? [];
      const proWithSvc = new Set(svcList.map((s: any) => s.professional_id));
      const missingSvc = proList.filter((p: any) => !proWithSvc.has(p.id));

      const wa = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? "";
      const waValid = /^\+?[1-9]\d{7,14}$/.test(wa.replace(/\s/g, ""));

      const checks: AutoCheck[] = [
        {
          id: "admin",
          label: "Pelo menos um admin cadastrado",
          ok: (adminCount.count ?? 0) > 0,
          detail: `${adminCount.count ?? 0} admin(s)`,
        },
        {
          id: "professionals",
          label: "Profissionais ativos",
          ok: proList.length > 0,
          detail: proList.length ? proList.map((p: any) => p.name).join(", ") : "Nenhum profissional ativo",
        },
        {
          id: "services",
          label: "Todo profissional tem ao menos um serviço ativo",
          ok: proList.length > 0 && missingSvc.length === 0,
          detail: missingSvc.length ? `Sem serviços: ${missingSvc.map((p: any) => p.name).join(", ")}` : `${svcList.length} serviços ativos`,
        },
        {
          id: "portfolio",
          label: "Galeria Antes/Depois com pelo menos 1 item aprovado",
          ok: (portfolioOk.count ?? 0) > 0,
          detail: `${portfolioOk.count ?? 0} aprovado(s)`,
        },
        {
          id: "whatsapp",
          label: "Número do WhatsApp configurado (VITE_WHATSAPP_NUMBER)",
          ok: waValid,
          detail: waValid ? wa : "Vazio ou fora do padrão E.164",
        },
        {
          id: "reminder",
          label: "Lembretes de 24h ativados com mensagem",
          ok: !!(reminderCfg.data?.enabled && reminderCfg.data?.message_template?.trim()),
          detail: reminderCfg.data?.enabled
            ? reminderCfg.data?.message_template?.trim() ? "Ativo e com mensagem" : "Ativo mas sem mensagem"
            : "Desativado",
        },
        {
          id: "reengagement",
          label: "Reengajamento ativado com mensagem",
          ok: !!(reengageCfg.data?.enabled && reengageCfg.data?.message_template?.trim()),
          detail: reengageCfg.data?.enabled
            ? reengageCfg.data?.message_template?.trim() ? "Ativo e com mensagem" : "Ativo mas sem mensagem"
            : "Desativado",
        },
      ];
      return checks;
    },
    staleTime: 30_000,
  });

  const items = auto.data ?? [];
  const autoDone = items.filter((c) => c.ok).length;
  const manualDone = MANUAL_ITEMS.filter((m) => manual[m.id]).length;
  const total = items.length + MANUAL_ITEMS.length;
  const done = autoDone + manualDone;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const ready = total > 0 && done === total;

  return (
    <div className="mt-6 space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl">Pré-lançamento</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest ${
              ready ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-primary/40 bg-primary/10 text-primary"
            }`}>
              {ready ? "Pronto para publicar" : `${done}/${total} concluídos`}
            </span>
            <Button variant="ghost" size="sm" onClick={() => auto.refetch()} disabled={auto.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${auto.isFetching ? "animate-spin" : ""}`} /> Rechecar
            </Button>
          </div>
        </div>
        <Progress className="mt-4" value={pct} />
        <p className="mt-2 text-xs text-muted-foreground">
          Checagens automáticas leem o estado real do sistema. Os itens manuais ficam salvos neste navegador.
        </p>
      </Card>

      <Card className="p-6">
        <h3 className="font-display text-lg mb-4">Checagens automáticas</h3>
        {auto.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-4 py-3">
                <div className="flex items-start gap-3">
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-emerald-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 flex-none text-destructive" />
                  )}
                  <div>
                    <div className="text-sm">{c.label}</div>
                    {c.detail && <div className="text-xs text-muted-foreground">{c.detail}</div>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-display text-lg mb-1">Itens manuais</h3>
        <p className="text-xs text-muted-foreground mb-4">Marque conforme confirmar cada um.</p>
        <ul className="space-y-3">
          {MANUAL_ITEMS.map((m) => (
            <li key={m.id} className="flex items-start gap-3">
              <Checkbox
                id={`chk-${m.id}`}
                checked={!!manual[m.id]}
                onCheckedChange={(v) => setManual((prev) => ({ ...prev, [m.id]: v === true }))}
                className="mt-0.5"
              />
              <label htmlFor={`chk-${m.id}`} className="cursor-pointer select-none">
                <div className={`text-sm ${manual[m.id] ? "line-through text-muted-foreground" : ""}`}>{m.label}</div>
                {m.hint && <div className="text-xs text-muted-foreground">{m.hint}</div>}
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setManual({})}>Limpar marcações</Button>
          <Button variant="ghost" size="sm" onClick={() => {
            const all: Record<string, boolean> = {};
            MANUAL_ITEMS.forEach((m) => (all[m.id] = true));
            setManual(all);
          }}>Marcar todos</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-display text-lg mb-2">Links úteis</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <UtilLink href="https://developers.facebook.com/tools/debug/" label="Debug OG (Facebook/WhatsApp)" />
          <UtilLink href="https://cards-dev.twitter.com/validator" label="Validador de Twitter Card" />
          <UtilLink href="https://search.google.com/test/rich-results" label="Google Rich Results" />
          <UtilLink href="https://pagespeed.web.dev/" label="PageSpeed Insights" />
        </div>
      </Card>
    </div>
  );
}

function UtilLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm hover:border-primary/40 hover:text-primary transition"
    >
      <span>{label}</span>
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}
