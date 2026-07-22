import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { Gift, Sparkles } from "lucide-react";

type Rules = {
  id: boolean;
  points_per_real: number;
  points_per_review: number;
  redeem_ratio: number;
  celebration_thresholds: number[];
  points_expire_months: number;
  enabled: boolean;
};

export function LoyaltyPanel() {
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [pts, setPts] = useState("");
  const [note, setNote] = useState("");

  const rulesQ = useQuery({
    queryKey: ["loyalty-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loyalty_rules").select("*").eq("id", true).single();
      if (error) throw error;
      return data as Rules;
    },
  });

  const summaryQ = useQuery({
    queryKey: ["loyalty-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_loyalty_summary")
        .select("*")
        .order("balance", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Array<{ phone_digits: string; balance: number; lifetime_earned: number; last_activity_at: string }>;
    },
  });

  const saveRules = useMutation({
    mutationFn: async (patch: Partial<Rules>) => {
      const { error } = await supabase.from("loyalty_rules").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Regras atualizadas"); qc.invalidateQueries({ queryKey: ["loyalty-rules"] }); },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  const grant = useMutation({
    mutationFn: async () => {
      const digits = phone.replace(/\D/g, "");
      const n = parseInt(pts, 10);
      if (!digits || !Number.isFinite(n) || n === 0) throw new Error("Preencha telefone e pontos (≠ 0)");
      const { error } = await supabase.rpc("admin_grant_loyalty_bonus", { _phone_digits: digits, _points: n, _note: note || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pontos aplicados");
      setPhone(""); setPts(""); setNote("");
      qc.invalidateQueries({ queryKey: ["loyalty-summary"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  const r = rulesQ.data;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-display text-xl">Programa de fidelidade</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Clientes ganham pontos automaticamente quando um agendamento é marcado como <strong>concluído</strong>.
          O saldo aparece no portal do cliente (link do agendamento).
        </p>

        {r && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="font-medium">Programa ativo</div>
                <div className="text-xs text-muted-foreground">Desligue para pausar todos os créditos.</div>
              </div>
              <Switch checked={r.enabled} onCheckedChange={(v) => saveRules.mutate({ enabled: v })} />
            </div>
            <div>
              <Label>Pontos por R$ 1 gasto</Label>
              <Input type="number" step="0.1" defaultValue={r.points_per_real}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v) && v !== r.points_per_real) saveRules.mutate({ points_per_real: v });
                }} />
            </div>
            <div>
              <Label>Pontos por avaliação enviada</Label>
              <Input type="number" defaultValue={r.points_per_review}
                onBlur={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v) && v !== r.points_per_review) saveRules.mutate({ points_per_review: v });
                }} />
            </div>
            <div>
              <Label>Pontos por R$ 1 de desconto (resgate)</Label>
              <Input type="number" step="0.1" defaultValue={r.redeem_ratio}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v) && v !== r.redeem_ratio) saveRules.mutate({ redeem_ratio: v });
                }} />
            </div>
            <div>
              <Label>Validade dos pontos (meses)</Label>
              <Input type="number" defaultValue={r.points_expire_months}
                onBlur={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v) && v !== r.points_expire_months) saveRules.mutate({ points_expire_months: v });
                }} />
            </div>
            <div>
              <Label>Marcos de celebração</Label>
              <Input defaultValue={r.celebration_thresholds.join(", ")}
                onBlur={(e) => {
                  const arr = e.target.value.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0);
                  saveRules.mutate({ celebration_thresholds: arr });
                }} />
              <p className="text-[11px] text-muted-foreground mt-1">Ao atingir, cliente vê modal comemorativo. Separe por vírgula.</p>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="h-5 w-5 text-primary" />
          <h3 className="font-display text-xl">Aplicar pontos manualmente</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Use valores negativos para registrar resgates. O crédito por atendimento é automático.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Telefone do cliente</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="15 99834-3669" />
          </div>
          <div>
            <Label>Pontos (+/-)</Label>
            <Input type="number" value={pts} onChange={(e) => setPts(e.target.value)} placeholder="ex: 100 ou -50" />
          </div>
          <div>
            <Label>Nota (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex: bônus indicação" />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => grant.mutate()} disabled={grant.isPending}>
            Aplicar
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-display text-xl mb-4">Top clientes por saldo</h3>
        {summaryQ.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {summaryQ.data && summaryQ.data.length === 0 && (
          <p className="text-sm text-muted-foreground">Ainda não há pontos registrados.</p>
        )}
        {summaryQ.data && summaryQ.data.length > 0 && (
          <div className="divide-y divide-border/50">
            {summaryQ.data.map((row) => (
              <div key={row.phone_digits} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-mono">{row.phone_digits}</div>
                  <div className="text-xs text-muted-foreground">
                    Histórico: {row.lifetime_earned} pts · última atividade {new Date(row.last_activity_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Badge variant="secondary">{row.balance} pts</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}