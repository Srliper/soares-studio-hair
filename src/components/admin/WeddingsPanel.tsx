import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Heart, Copy, Plus, Trash2, ExternalLink, Users } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function toLocalInput(v: string | Date) {
  const d = typeof v === "string" ? new Date(v) : v;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function WeddingsPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const pros = useQuery({
    queryKey: ["pros-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const packages = useQuery({
    queryKey: ["wedding-packages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("wedding_packages")
        .select("*, professionals(name), wedding_guests(id, guest_name, guest_phone, start_at, end_at, status, services(name))")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 30_000,
  });

  const create = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await (supabase as any).from("wedding_packages").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pacote criado");
      qc.invalidateQueries({ queryKey: ["wedding-packages"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from("wedding_packages").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["wedding-packages"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("wedding_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["wedding-packages"] });
    },
  });

  const removeGuest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("wedding_guests").update({ status: "cancelado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convidada removida");
      qc.invalidateQueries({ queryKey: ["wedding-packages"] });
    },
  });

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/casamento/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado — envie no grupo");
  };

  return (
    <div className="space-y-4 mt-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl">Pacote Noiva</h2>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo pacote</Button>
            </DialogTrigger>
            <NewPackageDialog pros={pros.data ?? []} onSubmit={(f) => create.mutate(f)} submitting={create.isPending} />
          </Dialog>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Crie um bloco reservado no dia do casamento e envie o link único para o grupo da noiva.
          Cada madrinha/mãe agenda o próprio horário dentro da janela reservada, sem colisão com o restante da agenda.
        </p>

        {packages.isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : (packages.data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum pacote ainda.</div>
        ) : (
          <div className="space-y-4">
            {(packages.data ?? []).map((p) => {
              const guests = (p.wedding_guests ?? []).filter((g: any) => g.status !== "cancelado");
              return (
                <div key={p.id} className="rounded-md border border-border/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.bride_name}</span>
                        <Badge variant="outline">{STATUS_LABEL[p.status] ?? p.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(p.event_date).toLocaleDateString("pt-BR")} · {p.professionals?.name}
                        {p.event_location && <> · {p.event_location}</>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Janela reservada: {new Date(p.block_start_at).toLocaleString("pt-BR")} → {new Date(p.block_end_at).toLocaleString("pt-BR")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <Users className="inline h-3 w-3 mr-1" />
                        {guests.length} / {p.max_guests} convidadas
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => copyLink(p.group_token)} aria-label="Copiar link do grupo">
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
                      </Button>
                      <a href={`/casamento/${p.group_token}`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost" aria-label="Abrir página do pacote">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                      <Select value={p.status} onValueChange={(v) => updateStatus.mutate({ id: p.id, status: v })}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABEL).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Excluir pacote de ${p.bride_name}?`)) remove.mutate(p.id); }} aria-label="Excluir pacote">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {guests.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {guests.map((g: any) => (
                        <div key={g.id} className="flex items-center justify-between rounded border border-border/30 p-2 text-xs">
                          <div className="min-w-0">
                            <div className="font-medium">{g.guest_name}</div>
                            <div className="text-muted-foreground">
                              {g.services?.name} · {new Date(g.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              –{new Date(g.end_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            <div className="text-muted-foreground">{g.guest_phone}</div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Cancelar horário de ${g.guest_name}?`)) removeGuest.mutate(g.id); }} aria-label="Cancelar convidada">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function NewPackageDialog({ pros, onSubmit, submitting }: { pros: any[]; onSubmit: (f: any) => void; submitting: boolean }) {
  const [bride_name, setBrideName] = useState("");
  const [bride_phone, setBridePhone] = useState("");
  const [event_date, setEventDate] = useState("");
  const [event_location, setEventLocation] = useState("");
  const [professional_id, setProfId] = useState<string>(pros[0]?.id ?? "");
  const [block_start_at, setStart] = useState("");
  const [block_end_at, setEnd] = useState("");
  const [max_guests, setMax] = useState(10);
  const [notes, setNotes] = useState("");

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo Pacote Noiva</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="wp-bride">Nome da noiva</Label>
          <Input id="wp-bride" value={bride_name} onChange={(e) => setBrideName(e.target.value)} maxLength={120} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="wp-phone">WhatsApp da noiva</Label>
          <Input id="wp-phone" value={bride_phone} onChange={(e) => setBridePhone(e.target.value)} placeholder="+55 15 99834-3669" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="wp-date">Data do evento</Label>
            <Input id="wp-date" type="date" value={event_date} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wp-pro">Profissional</Label>
            <Select value={professional_id} onValueChange={setProfId}>
              <SelectTrigger id="wp-pro"><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {pros.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="wp-loc">Local do evento (opcional)</Label>
          <Input id="wp-loc" value={event_location} onChange={(e) => setEventLocation(e.target.value)} maxLength={200} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="wp-start">Início da janela reservada</Label>
            <Input id="wp-start" type="datetime-local" value={block_start_at} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wp-end">Fim da janela reservada</Label>
            <Input id="wp-end" type="datetime-local" value={block_end_at} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="wp-max">Máx. convidadas</Label>
          <Input id="wp-max" type="number" min={1} max={30} value={max_guests} onChange={(e) => setMax(Number(e.target.value))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="wp-notes">Observações internas</Label>
          <Textarea id="wp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={submitting || !bride_name || !bride_phone || !event_date || !professional_id || !block_start_at || !block_end_at}
          onClick={() => {
            if (new Date(block_end_at) <= new Date(block_start_at)) {
              toast.error("Fim da janela deve ser depois do início"); return;
            }
            onSubmit({
              bride_name: bride_name.trim(),
              bride_phone: bride_phone.trim(),
              event_date,
              event_location: event_location.trim() || null,
              professional_id,
              block_start_at: new Date(block_start_at).toISOString(),
              block_end_at: new Date(block_end_at).toISOString(),
              max_guests,
              notes: notes.trim() || null,
              status: "ativo",
            });
          }}
        >
          Criar pacote
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}