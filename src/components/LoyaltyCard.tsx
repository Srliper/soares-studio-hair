import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, PartyPopper } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useState } from "react";

type Loyalty = {
  enabled: boolean;
  balance: number;
  lifetime_earned: number;
  thresholds: number[];
  redeem_ratio: number;
  history: Array<{ points: number; source: string; note: string | null; created_at: string; expires_at: string | null }>;
};

const sourceLabel: Record<string, string> = {
  appointment: "Atendimento",
  review: "Avaliação",
  referral: "Indicação",
  bonus: "Bônus",
  redeem: "Resgate",
};

export function LoyaltyCard({ token }: { token: string }) {
  const q = useQuery({
    queryKey: ["loyalty-by-token", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_loyalty_by_token", { _token: token });
      if (error) throw error;
      return data as unknown as Loyalty;
    },
    retry: false,
  });

  const [celebrated, setCelebrated] = useState<number | null>(null);

  useEffect(() => {
    if (!q.data) return;
    const key = `celebrated-${token}`;
    const seen = parseInt(localStorage.getItem(key) ?? "0", 10);
    const hit = q.data.thresholds
      .filter((t) => q.data!.balance >= t && t > seen)
      .sort((a, b) => b - a)[0];
    if (hit) {
      setCelebrated(hit);
      localStorage.setItem(key, String(hit));
    }
  }, [q.data, token]);

  if (!q.data || !q.data.enabled) return null;
  const l = q.data;
  const nextThreshold = l.thresholds.find((t) => t > l.balance);
  const discountReais = l.redeem_ratio > 0 ? Math.floor(l.balance / l.redeem_ratio) : 0;

  return (
    <>
      <Card className="p-6 mt-6 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-display text-xl">Meus pontos</h3>
        </div>
        <div className="mt-3 flex items-end gap-3">
          <div className="text-4xl font-display gold-gradient">{l.balance}</div>
          <div className="text-xs text-muted-foreground pb-1">
            pontos · histórico {l.lifetime_earned}
          </div>
        </div>
        {discountReais > 0 && (
          <p className="mt-2 text-sm text-primary">
            Você já pode resgatar até <strong>R$ {discountReais}</strong> de desconto no próximo atendimento.
          </p>
        )}
        {nextThreshold && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Próxima meta</span>
              <span>{l.balance} / {nextThreshold}</span>
            </div>
            <div className="h-2 rounded-full bg-border overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (l.balance / nextThreshold) * 100)}%` }} />
            </div>
          </div>
        )}
        {l.history.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-muted-foreground">Ver histórico</summary>
            <ul className="mt-2 divide-y divide-border/40 text-sm">
              {l.history.map((h, i) => (
                <li key={i} className="flex items-center justify-between py-2">
                  <div>
                    <div>{sourceLabel[h.source] ?? h.source}{h.note ? ` — ${h.note}` : ""}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <Badge variant={h.points >= 0 ? "secondary" : "outline"}>
                    {h.points >= 0 ? "+" : ""}{h.points}
                  </Badge>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <Dialog open={!!celebrated} onOpenChange={(v) => !v && setCelebrated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PartyPopper className="h-6 w-6 text-primary" /> Parabéns!
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <div className="text-6xl font-display gold-gradient mb-3">{celebrated}</div>
            <p className="text-sm text-muted-foreground">
              Você atingiu <strong>{celebrated} pontos</strong> no Studio Soares.
              Continue conosco e converta em desconto no próximo atendimento.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}