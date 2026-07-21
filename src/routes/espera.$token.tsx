import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Clock, CheckCircle2, XCircle, Bell, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/espera/$token")({
  head: () => ({
    meta: [
      { title: "Minha posição na lista de espera — Studio Soares" },
      { name: "description", content: "Acompanhe sua posição na lista de espera do Studio Soares em tempo real." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Minha posição na lista de espera — Studio Soares" },
      { property: "og:description", content: "Acompanhe sua posição na lista de espera em tempo real." },
    ],
  }),
  component: WaitlistTrackPage,
});

type Status = {
  id: string;
  client_name: string;
  status: "aguardando" | "notificado" | "convertido" | "cancelado" | string;
  desired_date: string;
  created_at: string;
  notified_at: string | null;
  notes: string | null;
  position: number | null;
  total: number | null;
  professional: { id: string; name: string };
  service: { id: string; name: string };
};

function WaitlistTrackPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["waitlist-status", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_waitlist_status", { _token: token });
      if (error) throw error;
      return data as unknown as Status;
    },
    retry: false,
    refetchInterval: 30_000,
  });

  // Realtime: refetch when this row changes
  useEffect(() => {
    const id = q.data?.id;
    if (!id) return;
    const channel = supabase
      .channel(`waitlist-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waitlist", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["waitlist-status", token] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [q.data?.id, qc, token]);

  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("leave_waitlist", { _token: token });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Você saiu da lista de espera");
      qc.invalidateQueries({ queryKey: ["waitlist-status", token] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  if (q.isLoading) {
    return <Shell><div className="text-sm text-muted-foreground">Carregando…</div></Shell>;
  }

  if (q.isError || !q.data) {
    return (
      <Shell>
        <div className="text-sm">Link inválido ou expirado.</div>
        <Link to="/" className="mt-4 inline-flex items-center gap-1 text-primary text-sm hover:underline">
          Voltar ao início <ArrowRight className="w-4 h-4" />
        </Link>
      </Shell>
    );
  }

  const w = q.data;
  const dateLabel = new Date(w.desired_date + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <Shell>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">Lista de espera</div>
      <h1 className="mt-2 text-2xl font-medium">Olá, {w.client_name.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {w.service.name} com {w.professional.name} · {dateLabel}
      </p>

      <div className="mt-6">
        <StatusBadge status={w.status} />
      </div>

      {w.status === "aguardando" && (
        <div className="mt-6 rounded-lg border border-border/60 bg-card p-6">
          <div className="flex items-baseline gap-3">
            <div className="text-5xl font-light text-primary">{w.position ?? "—"}</div>
            <div className="text-sm text-muted-foreground">
              de {w.total ?? "—"} {w.total === 1 ? "pessoa" : "pessoas"} na fila
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Assim que um horário abrir com {w.professional.name} nesta data, avisamos você por WhatsApp automaticamente.
          </p>
        </div>
      )}

      {w.status === "notificado" && (
        <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-6 text-sm">
          <div className="flex items-center gap-2 font-medium text-primary">
            <Bell className="w-4 h-4" /> Um horário abriu!
          </div>
          <p className="mt-2 text-muted-foreground">
            Enviamos um WhatsApp com o link para você confirmar. Notificado em{" "}
            {w.notified_at && new Date(w.notified_at).toLocaleString("pt-BR")}.
          </p>
          <Link to="/" className="mt-3 inline-flex items-center gap-1 text-primary hover:underline">
            Ir para o agendamento <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {w.status === "convertido" && (
        <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-sm">
          <div className="flex items-center gap-2 font-medium text-emerald-600">
            <CheckCircle2 className="w-4 h-4" /> Agendamento confirmado
          </div>
          <p className="mt-2 text-muted-foreground">Nos vemos em breve!</p>
        </div>
      )}

      {w.status === "cancelado" && (
        <div className="mt-6 rounded-lg border border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
          Sua inscrição foi cancelada.
        </div>
      )}

      {w.status === "aguardando" && (
        <div className="mt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Deseja sair da lista de espera?")) leave.mutate();
            }}
            disabled={leave.isPending}
            className="text-muted-foreground"
          >
            <XCircle className="w-4 h-4 mr-1" /> Sair da lista
          </Button>
        </div>
      )}

      <div className="mt-8 text-xs text-muted-foreground">
        Inscrito em {new Date(w.created_at).toLocaleString("pt-BR")}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-6 py-16">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
          ← Studio Soares
        </Link>
        <Card className="mt-6 p-8">{children}</Card>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    aguardando: { label: "Aguardando", className: "bg-amber-500/10 text-amber-700 border-amber-500/30", icon: <Clock className="w-3.5 h-3.5" /> },
    notificado: { label: "Notificado", className: "bg-primary/10 text-primary border-primary/30", icon: <Bell className="w-3.5 h-3.5" /> },
    convertido: { label: "Confirmado", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground border-border", icon: <XCircle className="w-3.5 h-3.5" /> },
  };
  const s = map[status] ?? map.aguardando;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${s.className}`}>
      {s.icon} {s.label}
    </span>
  );
}