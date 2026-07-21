import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Check, X, Trash2 } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  aguardando: "Aguardando",
  notificado: "Notificado",
  convertido: "Convertido",
  cancelado: "Cancelado",
};

export function WaitlistPanel({ restrictToProfessionalId }: { restrictToProfessionalId: string | null }) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["waitlist", restrictToProfessionalId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("waitlist")
        .select("*, professionals(name), services(name)")
        .order("desired_date", { ascending: true })
        .order("created_at", { ascending: true });
      if (restrictToProfessionalId) q = q.eq("professional_id", restrictToProfessionalId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("waitlist").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["waitlist"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("waitlist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["waitlist"] });
    },
  });

  return (
    <div className="space-y-4 mt-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl">Lista de espera</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Clientes aguardando um horário. Quando um agendamento correspondente é cancelado, o sistema
          envia automaticamente uma notificação (via webhook n8n) para os primeiros da fila.
        </p>
        {list.isLoading ? (
          <div className="text-muted-foreground text-sm">Carregando…</div>
        ) : (list.data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">Ninguém na lista de espera no momento.</div>
        ) : (
          <div className="space-y-2">
            {(list.data ?? []).map((w: any) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/40 p-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{w.client_name}</span>
                    <Badge variant="outline">{STATUS_LABEL[w.status] ?? w.status}</Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {w.professionals?.name} · {w.services?.name} ·{" "}
                    {new Date(w.desired_date).toLocaleDateString("pt-BR")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {w.client_phone}
                    {w.notified_at && <> · notificado em {new Date(w.notified_at).toLocaleString("pt-BR")}</>}
                  </div>
                  {w.notes && <div className="text-xs italic text-muted-foreground">"{w.notes}"</div>}
                </div>
                <div className="flex gap-1">
                  {w.status !== "convertido" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: w.id, status: "convertido" })}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Converter
                    </Button>
                  )}
                  {w.status !== "cancelado" && (
                    <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: w.id, status: "cancelado" })}>
                      <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover da lista?")) remove.mutate(w.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}