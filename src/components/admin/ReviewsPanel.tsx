import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Star, Play, Save, ExternalLink } from "lucide-react";
import {
  getReviewSettings,
  saveReviewSettings,
  runReviewNow,
  listReviewEvents,
} from "@/lib/review.functions";

export function ReviewsPanel() {
  const qc = useQueryClient();
  const getSettings = useServerFn(getReviewSettings);
  const saveSettings = useServerFn(saveReviewSettings);
  const runNow = useServerFn(runReviewNow);
  const listEvents = useServerFn(listReviewEvents);

  const settingsQ = useQuery({ queryKey: ["review-settings"], queryFn: () => getSettings() });
  const eventsQ = useQuery({ queryKey: ["review-events"], queryFn: () => listEvents(), refetchInterval: 15_000 });

  const [enabled, setEnabled] = useState(false);
  const [hours, setHours] = useState(3);
  const [cooldown, setCooldown] = useState(90);
  const [url, setUrl] = useState("");
  const [tpl, setTpl] = useState("");

  useEffect(() => {
    if (settingsQ.data) {
      setEnabled(settingsQ.data.enabled);
      setHours(settingsQ.data.hours_after);
      setCooldown(settingsQ.data.cooldown_days);
      setUrl(settingsQ.data.google_review_url);
      setTpl(settingsQ.data.message_template);
    }
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: () =>
      saveSettings({ data: { enabled, hours_after: hours, cooldown_days: cooldown, google_review_url: url, message_template: tpl } }),
    onSuccess: () => { toast.success("Configurações salvas"); qc.invalidateQueries({ queryKey: ["review-settings"] }); },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  const run = useMutation({
    mutationFn: () => runNow(),
    onSuccess: (r: any) => {
      toast.success(`Processados: ${r.processed} · Enviados: ${r.sent} · Já enviados: ${r.skipped_sent ?? 0} · Cooldown: ${r.skipped_cooldown ?? 0}${r.reason ? ` (${r.reason})` : ""}`);
      qc.invalidateQueries({ queryKey: ["review-events"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha na execução"),
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl">Avaliações automáticas</h2>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Envia um pedido de avaliação no Google via <strong>n8n</strong> algumas horas depois de cada atendimento concluído.
          Cliente que já recebeu no <strong>cooldown</strong> não é contactado de novo.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border border-border/50 p-3">
            <div>
              <div className="font-medium">Ativo</div>
              <div className="text-xs text-muted-foreground">Quando ligado, o job envia pedidos automaticamente.</div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <Label htmlFor="hours">Enviar após (horas)</Label>
            <Input id="hours" type="number" min={1} max={168} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </div>

          <div>
            <Label htmlFor="cooldown">Cooldown por cliente (dias)</Label>
            <Input id="cooldown" type="number" min={1} max={365} value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} />
          </div>

          <div>
            <Label htmlFor="url">Link Google para avaliação</Label>
            <Input id="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://g.page/r/…/review" />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="tpl">Mensagem (use <code>{"{{name}}"}</code>, <code>{"{{url}}"}</code>, <code>{"{{professional}}"}</code>, <code>{"{{service}}"}</code>)</Label>
            <Textarea id="tpl" rows={3} value={tpl} onChange={(e) => setTpl(e.target.value)} maxLength={1000} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-1" />{save.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="outline" onClick={() => run.mutate()} disabled={run.isPending}>
            <Play className="h-4 w-4 mr-1" />{run.isPending ? "Executando…" : "Rodar agora"}
          </Button>
          <a href="https://support.google.com/business/answer/7035772" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
            Como pegar o link do Google <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100">
          <strong>Setup:</strong> configure o secret <code>N8N_REVIEW_WEBHOOK_URL</code> no backend com a URL do seu workflow n8n
          (trigger Webhook POST → nó WhatsApp/SMS). Sem o secret, o job roda em <em>dry_run</em> — nada é enviado, mas você vê no histórico quem seria contactado.
          O cron horário procura atendimentos que terminaram entre <em>hours_after</em> e <em>hours_after + 24h</em> atrás.
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 font-display text-lg">Histórico de envios</h3>
        {eventsQ.isLoading ? (
          <div className="text-muted-foreground">Carregando…</div>
        ) : (eventsQ.data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum envio ainda.</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border/50">
                  <th className="py-2 text-left font-medium">Quando</th>
                  <th className="py-2 text-left font-medium">Cliente</th>
                  <th className="py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(eventsQ.data ?? []).map((e: any) => (
                  <tr key={e.id} className="border-b border-border/20 align-top">
                    <td className="py-2 text-xs text-muted-foreground">{new Date(e.sent_at).toLocaleString("pt-BR")}</td>
                    <td className="py-2">
                      <div>{e.appointment?.client_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{e.appointment?.client_phone}</div>
                    </td>
                    <td className="py-2">
                      <span className={e.status === "sent" ? "text-emerald-400" : e.status === "dry_run" ? "text-amber-400" : "text-red-400"}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}