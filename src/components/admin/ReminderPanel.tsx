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
import { BellRing, Play, Save } from "lucide-react";
import { getReminderSettings, saveReminderSettings, runReminderNow } from "@/lib/reminder.functions";

export function ReminderPanel() {
  const qc = useQueryClient();
  const getS = useServerFn(getReminderSettings);
  const saveS = useServerFn(saveReminderSettings);
  const runN = useServerFn(runReminderNow);

  const q = useQuery({ queryKey: ["reminder-settings"], queryFn: () => getS() });

  const [enabled, setEnabled] = useState(false);
  const [hours, setHours] = useState(24);
  const [tpl, setTpl] = useState("");

  useEffect(() => {
    if (q.data) {
      setEnabled(q.data.enabled);
      setHours(q.data.hours_before);
      setTpl(q.data.message_template);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => saveS({ data: { enabled, hours_before: hours, message_template: tpl } }),
    onSuccess: () => { toast.success("Configurações salvas"); qc.invalidateQueries({ queryKey: ["reminder-settings"] }); },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });
  const run = useMutation({
    mutationFn: () => runN(),
    onSuccess: (r: any) => toast.success(`Processados: ${r.processed} · Enviados: ${r.sent}`),
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  return (
    <Card className="p-6 mt-6">
      <div className="mb-4 flex items-center gap-2">
        <BellRing className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl">Lembretes automáticos</h2>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Envia lembrete (via webhook n8n) para agendamentos que acontecem daqui a <strong>{hours}h</strong>, com link para reagendar ou cancelar.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-md border border-border/50 p-3">
          <div>
            <div className="font-medium">Ativo</div>
            <div className="text-xs text-muted-foreground">O job diário envia lembretes automaticamente.</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div>
          <Label htmlFor="hours">Horas antes do agendamento</Label>
          <Input id="hours" type="number" min={1} max={168} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="tpl">Mensagem</Label>
          <Textarea id="tpl" rows={3} value={tpl} maxLength={1000} onChange={(e) => setTpl(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">
            Variáveis: <code>{"{{name}}"}</code>, <code>{"{{when}}"}</code>, <code>{"{{professional}}"}</code>, <code>{"{{service}}"}</code>, <code>{"{{manage_link}}"}</code>
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-1" />{save.isPending ? "Salvando…" : "Salvar"}
        </Button>
        <Button variant="outline" onClick={() => run.mutate()} disabled={run.isPending}>
          <Play className="h-4 w-4 mr-1" />{run.isPending ? "Executando…" : "Rodar agora"}
        </Button>
      </div>
      <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100">
        Configure o secret <code>N8N_REMINDER_WEBHOOK_URL</code> (ou reutiliza <code>N8N_REENGAGEMENT_WEBHOOK_URL</code>) para enviar via WhatsApp/SMS. Sem webhook, roda em <em>dry_run</em>.
      </div>
    </Card>
  );
}