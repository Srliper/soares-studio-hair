import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatPrice, formatTime, categoryLabel, type ServiceCategory } from "@/lib/format";
import { Calendar, Clock, Edit, Plus, Trash2, LogOut, Phone, User, ArrowLeft, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

function useAccess() {
  return useQuery({
    queryKey: ["admin-access"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return { isAdmin: false, professionalId: null as string | null };
      const [{ data: adminRow }, { data: proRow }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.user.id).eq("role", "admin").maybeSingle(),
        supabase.from("professionals").select("id").eq("user_id", user.user.id).maybeSingle(),
      ]);
      return { isAdmin: !!adminRow, professionalId: proRow?.id ?? null };
    },
  });
}

function AdminPage() {
  const { data: access, isLoading } = useAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  const isAdmin = !!access?.isAdmin;
  const professionalId = access?.professionalId ?? null;
  if (!isAdmin && !professionalId) return <NotAdminScreen onSignOut={signOut} />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <div className="font-display text-xl gold-gradient">{isAdmin ? "Painel Admin" : "Meu Painel"}</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Ateliê A&A</div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-primary">Ver site</Link>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Sair</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Tabs defaultValue={isAdmin ? "appointments" : "services"}>
          <TabsList>
            {isAdmin && <TabsTrigger value="appointments"><Calendar className="h-4 w-4 mr-1" /> Agendamentos</TabsTrigger>}
            <TabsTrigger value="services"><Edit className="h-4 w-4 mr-1" /> Serviços & Preços</TabsTrigger>
          </TabsList>
          {isAdmin && <TabsContent value="appointments"><AppointmentsPanel /></TabsContent>}
          <TabsContent value="services"><ServicesPanel restrictToProfessionalId={isAdmin ? null : professionalId} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function NotAdminScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md p-8 text-center border-primary/30">
        <ShieldAlert className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 font-display text-2xl">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta ainda não tem permissão de administrador. Peça a um admin existente para liberar seu acesso.
        </p>
        <div className="mt-6 flex gap-2 justify-center">
          <Link to="/"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" /> Início</Button></Link>
          <Button onClick={onSignOut} variant="ghost">Sair</Button>
        </div>
        <div className="mt-6 rounded-md border border-border p-3 text-left text-xs text-muted-foreground">
          <strong className="text-foreground">Primeiro acesso?</strong>
          <p className="mt-1">Após criar sua conta, o primeiro admin precisa ser cadastrado pelo painel do Lovable Cloud na tabela <code className="text-primary">user_roles</code> com o valor <code className="text-primary">admin</code>.</p>
        </div>
      </Card>
    </div>
  );
}

// ------- Appointments -------
function AppointmentsPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-appointments", filter],
    queryFn: async () => {
      let q = supabase.from("appointments").select("*, professionals(name), services(name, price_cents)").order("start_at", { ascending: true });
      if (filter === "upcoming") q = q.gte("start_at", new Date().toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-appointments"] }); toast.success("Atualizado"); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-appointments"] }); toast.success("Removido"); },
  });

  return (
    <div className="space-y-4 mt-6">
      <div className="flex gap-2">
        <Button variant={filter === "upcoming" ? "default" : "outline"} size="sm" onClick={() => setFilter("upcoming")}>Próximos</Button>
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>Todos</Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}
      {data?.length === 0 && <p className="text-muted-foreground text-sm">Nenhum agendamento.</p>}
      <div className="space-y-3">
        {data?.map((a: any) => {
          const d = new Date(a.start_at);
          return (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2">
                    <div className="font-display text-lg">{d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</div>
                    <Badge variant="outline" className="border-primary/40 text-primary"><Clock className="h-3 w-3 mr-1" /> {formatTime(d)}</Badge>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-2 text-sm">
                    <div><strong>{a.services?.name}</strong> — {a.professionals?.name}</div>
                    <div className="text-muted-foreground flex items-center gap-3 mt-1">
                      <span><User className="inline h-3 w-3 mr-1" />{a.client_name}</span>
                      <span><Phone className="inline h-3 w-3 mr-1" />{a.client_phone}</span>
                      <span className="text-primary">{formatPrice(a.services?.price_cents ?? 0)}</span>
                    </div>
                    {a.client_notes && <div className="mt-2 text-xs text-muted-foreground italic">"{a.client_notes}"</div>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Select value={a.status} onValueChange={(v) => update.mutate({ id: a.id, status: v })}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover agendamento?")) del.mutate(a.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendente: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    confirmado: "bg-green-500/20 text-green-300 border-green-500/40",
    concluido: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    cancelado: "bg-red-500/20 text-red-300 border-red-500/40",
  };
  return <Badge variant="outline" className={map[status]}>{status}</Badge>;
}

// ------- Services -------
function ServicesPanel({ restrictToProfessionalId }: { restrictToProfessionalId: string | null }) {
  const qc = useQueryClient();
  const { data: pros } = useQuery({
    queryKey: ["all-pros", restrictToProfessionalId],
    queryFn: async () => {
      let q = supabase.from("professionals").select("*").order("name");
      if (restrictToProfessionalId) q = q.eq("id", restrictToProfessionalId);
      return (await q).data ?? [];
    },
  });
  const { data: services } = useQuery({
    queryKey: ["all-services"],
    queryFn: async () => (await supabase.from("services").select("*").order("sort_order")).data ?? [],
  });

  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState<{ professional_id: string } | null>(null);

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("services").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-services"] }); qc.invalidateQueries({ queryKey: ["services"] }); toast.success("Removido"); },
  });

  return (
    <div className="mt-6 space-y-8">
      {pros?.map((p: any) => {
        const list = (services ?? []).filter((s: any) => s.professional_id === p.id);
        return (
          <div key={p.id}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="font-display text-2xl">{p.name}</div>
                <div className="text-xs uppercase tracking-widest text-primary/80">{p.role_title}</div>
              </div>
              <Button size="sm" onClick={() => setCreating({ professional_id: p.id })}>
                <Plus className="h-4 w-4 mr-1" /> Novo serviço
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {list.map((s: any) => (
                <Card key={s.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {categoryLabel[s.category as ServiceCategory]} · {s.duration_minutes} min
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-display text-lg gold-gradient">{formatPrice(s.price_cents)}</div>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(s)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) del.mutate(s.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
              {list.length === 0 && <p className="text-sm text-muted-foreground col-span-full">Sem serviços cadastrados.</p>}
            </div>
          </div>
        );
      })}

      <ServiceDialog
        open={!!editing || !!creating}
        onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(null); } }}
        service={editing}
        professionalId={creating?.professional_id}
      />
    </div>
  );
}

function ServiceDialog({ open, onOpenChange, service, professionalId }: {
  open: boolean; onOpenChange: (o: boolean) => void; service?: any; professionalId?: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ServiceCategory>("masculino");
  const [priceReais, setPriceReais] = useState("0");
  const [duration, setDuration] = useState("30");

  useEffect(() => {
    if (service) {
      setName(service.name); setCategory(service.category);
      setPriceReais((service.price_cents / 100).toFixed(2)); setDuration(String(service.duration_minutes));
    } else {
      setName(""); setCategory("masculino"); setPriceReais("0"); setDuration("30");
    }
  }, [service, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name, category,
        price_cents: Math.round(parseFloat(priceReais.replace(",", ".")) * 100),
        duration_minutes: parseInt(duration, 10),
      };
      if (service) {
        const { error } = await supabase.from("services").update(payload).eq("id", service.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert({ ...payload, professional_id: professionalId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-services"] });
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success("Salvo");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service ? "Editar serviço" : "Novo serviço"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v: any) => setCategory(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["masculino", "feminino", "noiva", "manicure", "outro"] as ServiceCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>{categoryLabel[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={priceReais} onChange={(e) => setPriceReais(e.target.value)} /></div>
            <div><Label>Duração (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!name || save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
