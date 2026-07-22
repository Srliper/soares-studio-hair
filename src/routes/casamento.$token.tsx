import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Heart, Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/casamento/$token")({
  head: () => ({
    meta: [
      { title: "Pacote Noiva — Studio Soares Hair" },
      { name: "description", content: "Agende seu horário dentro do pacote da noiva no Studio Soares Hair." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: WeddingPage,
});

type WeddingData = {
  package: {
    id: string;
    bride_name: string;
    event_date: string;
    event_location: string | null;
    block_start_at: string;
    block_end_at: string;
    max_guests: number;
    status: string;
    notes: string | null;
    professional_id: string;
  };
  busy_slots: { start_at: string; end_at: string }[];
  guests_count: number;
  services: { id: string; name: string; duration_minutes: number; price_cents: number }[];
};

function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function slotOverlaps(startISO: string, minutes: number, busy: { start_at: string; end_at: string }[]) {
  const s = new Date(startISO).getTime();
  const e = s + minutes * 60_000;
  return busy.some((b) => {
    const bs = new Date(b.start_at).getTime();
    const be = new Date(b.end_at).getTime();
    return s < be && e > bs;
  });
}

function buildSlots(blockStart: string, blockEnd: string, stepMin = 30) {
  const out: string[] = [];
  const s = new Date(blockStart);
  const e = new Date(blockEnd);
  const cur = new Date(s);
  while (cur < e) {
    out.push(cur.toISOString());
    cur.setMinutes(cur.getMinutes() + stepMin);
  }
  return out;
}

function WeddingPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["wedding", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_wedding_by_token" as any, { _token: token });
      if (error) throw error;
      return data as WeddingData;
    },
    retry: false,
  });

  const [guest_name, setName] = useState("");
  const [guest_phone, setPhone] = useState("");
  const [service_id, setService] = useState<string>("");
  const [start_at, setStart] = useState<string>("");
  const [consent, setConsent] = useState(false);

  const book = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("book_wedding_guest" as any, {
        _token: token,
        _guest_name: guest_name,
        _guest_phone: guest_phone,
        _service_id: service_id,
        _start_at: start_at,
        _consent: consent,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário confirmado! ✨");
      setName(""); setPhone(""); setStart(""); setConsent(false);
      qc.invalidateQueries({ queryKey: ["wedding", token] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao agendar"),
  });

  const svc = useMemo(() => q.data?.services.find((s) => s.id === service_id) ?? null, [q.data, service_id]);

  const slots = useMemo(() => {
    if (!q.data) return [];
    return buildSlots(q.data.package.block_start_at, q.data.package.block_end_at, 30);
  }, [q.data]);

  if (q.isLoading) return <div className="p-10 text-center text-muted-foreground">Carregando…</div>;
  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <h1 className="font-display text-2xl mb-2">Pacote não encontrado</h1>
        <p className="text-sm text-muted-foreground">Peça um novo link para a noiva ou para o Studio Soares.</p>
        <Link to="/" className="mt-4 inline-block text-primary underline text-sm">Voltar ao site</Link>
      </div>
    );
  }

  const { package: pkg, busy_slots, guests_count } = q.data;
  const isFull = guests_count >= pkg.max_guests;
  const isClosed = pkg.status !== "ativo";

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-primary/80">
            <Heart className="h-3 w-3" /> Pacote Noiva
          </div>
          <h1 className="font-display text-3xl mt-3 gold-gradient">{pkg.bride_name}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {new Date(pkg.event_date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            {pkg.event_location && <> · {pkg.event_location}</>}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Janela do grupo: {new Date(pkg.block_start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {" "}às{" "}
            {new Date(pkg.block_end_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Badge variant="outline">{guests_count} / {pkg.max_guests} confirmadas</Badge>
            {isClosed && <Badge variant="destructive">Encerrado</Badge>}
          </div>
          {pkg.notes && <p className="mt-4 text-sm italic text-muted-foreground">"{pkg.notes}"</p>}
        </div>

        <Card className="p-6">
          {isClosed ? (
            <div className="text-center text-sm text-muted-foreground">Este pacote não está mais aceitando agendamentos.</div>
          ) : isFull ? (
            <div className="text-center text-sm text-muted-foreground">Pacote lotado — fale com a noiva ou com o Studio.</div>
          ) : (
            <div className="grid gap-4" role="form" aria-label="Formulário de agendamento no pacote noiva">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Reserve seu horário dentro da janela do grupo.</span>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="wg-name">Seu nome</Label>
                <Input id="wg-name" value={guest_name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="wg-phone">Seu WhatsApp</Label>
                <Input id="wg-phone" value={guest_phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 15 99999-9999" required />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="wg-service">Serviço</Label>
                <Select value={service_id} onValueChange={setService}>
                  <SelectTrigger id="wg-service"><SelectValue placeholder="Escolha um serviço" /></SelectTrigger>
                  <SelectContent>
                    {q.data.services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.duration_minutes}min — {fmtMoney(s.price_cents)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {svc && (
                <div className="grid gap-2">
                  <Label>Horário</Label>
                  <div role="listbox" aria-label="Horários disponíveis" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((iso) => {
                      const busy = slotOverlaps(iso, svc.duration_minutes, busy_slots);
                      const past = new Date(iso).getTime() < Date.now();
                      const endsAfter = new Date(iso).getTime() + svc.duration_minutes * 60_000 > new Date(pkg.block_end_at).getTime();
                      const disabled = busy || past || endsAfter;
                      const selected = start_at === iso;
                      return (
                        <button
                          key={iso}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          disabled={disabled}
                          onClick={() => setStart(iso)}
                          className={`rounded border px-2 py-2 text-xs transition
                            ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}
                            ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                        >
                          {new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </button>
                      );
                    })}
                  </div>
                  <div aria-live="polite" className="sr-only">
                    {start_at ? `Horário selecionado: ${new Date(start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </div>
                </div>
              )}

              <label className="flex items-start gap-3 rounded-md border border-border/40 p-3 text-xs">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  aria-describedby="wg-consent-desc"
                />
                <span id="wg-consent-desc" className="text-muted-foreground">
                  Autorizo o Studio Soares Hair a tratar meu nome e telefone exclusivamente para
                  organizar este agendamento (LGPD, art. 7º, I). Posso revogar a qualquer momento.
                </span>
              </label>

              <Button
                onClick={() => book.mutate()}
                disabled={book.isPending || !guest_name || !guest_phone || !service_id || !start_at || !consent}
                className="w-full"
              >
                <Check className="h-4 w-4 mr-1" /> Confirmar meu horário
              </Button>
            </div>
          )}
        </Card>

        <div className="mt-6 text-center">
          <Link to="/" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-primary">
            Studio Soares Hair
          </Link>
        </div>
      </div>
    </main>
  );
}