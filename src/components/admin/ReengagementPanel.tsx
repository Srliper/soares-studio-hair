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
import { Bell, Play, Save, ExternalLink } from "lucide-react";
import {
  getReengagementSettings,
  saveReengagementSettings,
  runReengagementNow,
  listReengagementEvents,
} from "@/lib/reengagement.functions";

export function ReengagementPanel() {
  const qc = useQueryClient();
  const getSettings = useServerFn(getReengagementSettings);
  const saveSettings = useServerFn(saveReengagementSettings);
  const runNow = useServerFn(runReengagementNow);
  const listEvents = useServerFn(listReengagementEvents);

  const settingsQ = useQuery({
    queryKey: ["reengagement-settings"],
    queryFn: () => getSettings(),
  });
  const eventsQ = useQuery({
    queryKey: ["reengagement-events"],
    queryFn: () => listEvents(),
    refetchInterval: 15_000,
  });

  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState(45);
  const [cooldown, setCooldown] = useState(30);
  const [tpl, setTpl] = useState("");

  useEffect(() => {
    if (settingsQ.data) {
      setEnabled(settingsQ.data.enabled);
      setDays(settingsQ.data.days_threshold);
      setCooldown(settingsQ.data.cooldown_days);
      setTpl(settingsQ.data.message_template);
    }
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: () =>
      saveSettings({
        data: { enabled, days_threshold: days, cooldown_days: cooldown, message_template: tpl },
      }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["reengagement-settings"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  const run = useMutation({
    mutationFn: () => runNow(),
    onSuccess: (r: any) => {
      toast.success(
        `Processados: ${r.processed} · Enviados: ${r.sent} · Ignorados: ${r.skipped_cooldown ?? 0}${
          r.reason ? ` (${r.reason})` : ""
        }`,
      );
      qc.invalidateQueries({ queryKey: ["reengagement-events"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha na execução"),
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl">Reengajamento automático</h2>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Manda mensagem via <strong>n8n</strong> (ou qualquer webhook) para clientes que não voltam há{" "}
          <strong>{days} dias</strong>. Os nomes e telefones são coletados automaticamente dos agendamentos.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border border-border/50 p-3">
            <div>
              <div className="font-medium">Ativo</div>
              <div className="text-xs text-muted-foreground">
                Quando ligado, o job diário envia mensagens automaticamente.
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <Label htmlFor="days">Dias sem visita</Label>
            <Input
              id="days"
              type="number"
              min={7}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="cooldown">Cooldown entre mensagens (dias)</Label>
            <Input
              id="cooldown"
              type="number"
              min={7}
              max={365}
              value={cooldown}
              onChange={(e) => setCooldown(Number(e.target.value))}
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="tpl">Mensagem (use <code>{"{{name}}"}</code>)</Label>
            <Textarea
              id="tpl"
              rows={3}
              value={tpl}
              onChange={(e) => setTpl(e.target.value)}
              maxLength={1000}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            variant="outline"
            onClick={() => run.mutate()}
            disabled={run.isPending}
          >
            <Play className="h-4 w-4 mr-1" />
            {run.isPending ? "Executando…" : "Rodar agora"}
          </Button>
          <a
            href="https://docs.n8n.io/integrations/creating-nodes/build/reference/webhooks/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            Como configurar n8n <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100">
          <strong>Setup n8n:</strong> Crie um workflow com um trigger <em>Webhook</em> (POST) e um nó de
          WhatsApp/SMS. Copie a URL do webhook e adicione como secret{" "}
          <code>N8N_REENGAGEMENT_WEBHOOK_URL</code> no backend. Enquanto o secret não estiver configurado,
          as execuções rodam em modo <em>dry_run</em> — nada é enviado, mas você vê no log abaixo quem seria contatado.
          <br />
          <strong>Payload enviado:</strong>{" "}
          <code>{`{ customer_id, name, phone, phone_display, last_visit_at, message }`}</code>
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
                    <td className="py-2 text-xs text-muted-foreground">
                      {new Date(e.sent_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2">
                      <div>{e.customer?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{e.customer?.phone_display}</div>
                    </td>
                    <td className="py-2">
                      <span
                        className={
                          e.status === "sent"
                            ? "text-emerald-400"
                            : e.status === "dry_run"
                              ? "text-amber-400"
                              : "text-red-400"
                        }
                      >
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