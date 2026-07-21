import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { CalendarX, Plus, Trash2 } from "lucide-react";

export function TimeBlocksPanel({ restrictToProfessionalId }: { restrictToProfessionalId: string | null }) {
  const qc = useQueryClient();
  const [proId, setProId] = useState<string>(restrictToProfessionalId ?? "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");

  const pros = useQuery({
    queryKey: ["admin-pros-for-blocks"],
    enabled: !restrictToProfessionalId,
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("id,name").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = useQuery({
    queryKey: ["time-blocks", restrictToProfessionalId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("time_blocks").select("*, professionals(name)").order("start_at", { ascending: true });
      if (restrictToProfessionalId) q = q.eq("professional_id", restrictToProfessionalId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const add = useMutation({
    mutationFn: async () => {
      const target = restrictToProfessionalId ?? proId;
      if (!target) throw new Error("Escolha um profissional");
      if (!startAt || !endAt) throw new Error("Informe início e fim");
      const s = new Date(startAt), e = new Date(endAt);
      if (e <= s) throw new Error("Fim deve ser depois do início");
      const { error } = await supabase.from("time_blocks").insert({
        professional_id: target,
        start_at: s.toISOString(),
        end_at: e.toISOString(),
        reason: reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bloqueio criado");
      setStartAt(""); setEndAt(""); setReason("");
      qc.invalidateQueries({ queryKey: ["time-blocks"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar bloqueio"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["time-blocks"] }); },
  });

  return (
    <div className="space-y-6 mt-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarX className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl">Novo bloqueio / folga</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {!restrictToProfessionalId && (
            <div className="md:col-span-2">
              <Label>Profissional</Label>
              <Select value={proId} onValueChange={setProId}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>
                  {(pros.data ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Início</Label>
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Motivo (opcional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ex.: Folga, curso, viagem…" />
          </div>
        </div>
        <Button className="mt-4" onClick={() => add.mutate()} disabled={add.isPending}>
          <Plus className="h-4 w-4 mr-1" />{add.isPending ? "Salvando…" : "Bloquear horário"}
        </Button>
      </Card>

      <Card className="p-6">
        <h3 className="font-display text-lg mb-4">Bloqueios cadastrados</h3>
        {list.isLoading ? (
          <div className="text-muted-foreground text-sm">Carregando…</div>
        ) : (list.data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum bloqueio.</div>
        ) : (
          <div className="space-y-2">
            {(list.data ?? []).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between rounded-md border border-border/40 p-3 text-sm">
                <div>
                  <div className="font-medium">
                    {b.professionals?.name ?? "—"} <span className="text-muted-foreground">·</span>{" "}
                    {new Date(b.start_at).toLocaleString("pt-BR")} → {new Date(b.end_at).toLocaleString("pt-BR")}
                  </div>
                  {b.reason && <div className="text-xs text-muted-foreground italic">"{b.reason}"</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover bloqueio?")) del.mutate(b.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}