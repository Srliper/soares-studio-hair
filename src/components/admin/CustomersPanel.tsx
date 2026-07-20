import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import { Users } from "lucide-react";

type Customer = {
  id: string;
  name: string;
  phone_digits: string;
  phone_display: string;
  last_visit_at: string;
  first_visit_at: string;
  total_appointments: number;
  opted_out: boolean;
};

export function CustomersPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name,phone_digits,phone_display,first_visit_at,last_visit_at,total_appointments,opted_out")
        .order("last_visit_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Customer[];
    },
  });

  const toggleOptOut = useMutation({
    mutationFn: async ({ id, opted_out }: { id: string; opted_out: boolean }) => {
      const { error } = await supabase.from("customers").update({ opted_out }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-customers"] }),
    onError: (e: any) => toast.error(e.message ?? "Falha ao atualizar"),
  });

  const rows = (data ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone_digits.includes(q.replace(/\D/g, ""));
  });

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl">Clientes</h2>
          <span className="text-xs text-muted-foreground">
            {data?.length ?? 0} coletados dos agendamentos
          </span>
        </div>
        <Input
          placeholder="Buscar nome ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border/50">
                <th className="py-2 text-left font-medium">Nome</th>
                <th className="py-2 text-left font-medium">Telefone</th>
                <th className="py-2 text-right font-medium">Visitas</th>
                <th className="py-2 text-left font-medium">Última visita</th>
                <th className="py-2 text-center font-medium">Opt-out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border/20">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2">
                    <a
                      href={`https://wa.me/${c.phone_digits}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {c.phone_display}
                    </a>
                  </td>
                  <td className="py-2 text-right">{c.total_appointments}</td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(c.last_visit_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="py-2 text-center">
                    <Button
                      size="sm"
                      variant={c.opted_out ? "destructive" : "outline"}
                      onClick={() => toggleOptOut.mutate({ id: c.id, opted_out: !c.opted_out })}
                    >
                      {c.opted_out ? "Não receber" : "Recebe"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}