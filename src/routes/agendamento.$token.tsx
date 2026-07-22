import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { formatPrice, formatTime } from "@/lib/format";
import { CalendarClock, XCircle, ArrowRight, Check } from "lucide-react";
import { LoyaltyCard } from "@/components/LoyaltyCard";

export const Route = createFileRoute("/agendamento/$token")({
  head: () => ({ meta: [{ title: "Meu agendamento — Studio Soares" }] }),
  component: ManagePage,
});

type Apt = {
  id: string;
  client_name: string;
  start_at: string;
  end_at: string;
  status: string;
  professional: { id: string; name: string };
  service: { id: string; name: string; duration_minutes: number; price: number };
};

function ManagePage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const [rescheduling, setRescheduling] = useState(false);
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");

  const aptQ = useQuery({
    queryKey: ["apt-by-token", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_appointment_by_token", { _token: token });
      if (error) throw error;
      return data as Apt;
    },
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_appointment_by_token", { _token: token });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Agendamento cancelado"); qc.invalidateQueries({ queryKey: ["apt-by-token", token] }); },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  const reschedule = useMutation({
    mutationFn: async () => {
      if (!day || !slot) throw new Error("Escolha um novo dia e horário");
      const newStart = new Date(`${day}T${slot}:00`);
      const { error } = await supabase.rpc("reschedule_appointment_by_token", { _token: token, _new_start: newStart.toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário atualizado");
      setRescheduling(false); setDay(""); setSlot("");
      qc.invalidateQueries({ queryKey: ["apt-by-token", token] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível reagendar"),
  });

  const days = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() + i);
      return d;
    }).filter((d) => d.getDay() !== 0);
  }, []);

  const slots = useMemo(() => {
    if (!day) return [] as string[];
    const out: string[] = [];
    for (let h = 9; h < 19; h++) {
      for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
    return out;
  }, [day]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-4 text-center">
          <div className="font-display text-xl tracking-[0.35em] gold-gradient">STUDIO SOARES</div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mt-0.5">Meu agendamento</div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        {aptQ.isLoading && <p className="text-muted-foreground">Carregando…</p>}
        {aptQ.isError && (
          <Card className="p-8 text-center">
            <h2 className="font-display text-2xl">Link inválido</h2>
            <p className="mt-2 text-sm text-muted-foreground">Este link expirou ou não é mais válido.</p>
            <Link to="/" className="mt-4 inline-block text-primary underline underline-offset-4">Voltar ao site</Link>
          </Card>
        )}
        {aptQ.data && (
          <Card className="p-8">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              <h2 className="font-display text-2xl">Olá, {aptQ.data.client_name.split(" ")[0]}!</h2>
            </div>
            <div className="mt-4 space-y-1 text-sm">
              <div><strong>{aptQ.data.service.name}</strong> com <strong>{aptQ.data.professional.name}</strong></div>
              <div className="text-muted-foreground">
                {new Date(aptQ.data.start_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} às {formatTime(new Date(aptQ.data.start_at))}
              </div>
              <div className="text-primary">{formatPrice(aptQ.data.service.price ?? 0)}</div>
              <div className="mt-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Status:</span>{" "}
                <span className="text-foreground">{aptQ.data.status}</span>
              </div>
            </div>

            {aptQ.data.status === "cancelado" ? (
              <div className="mt-6 rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
                Este agendamento foi cancelado. <Link to="/" className="underline">Fazer novo agendamento</Link>
              </div>
            ) : (
              <>
                {!rescheduling ? (
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button onClick={() => setRescheduling(true)}>
                      <ArrowRight className="h-4 w-4 mr-1" /> Reagendar
                    </Button>
                    <Button variant="outline" onClick={() => { if (confirm("Cancelar este agendamento?")) cancel.mutate(); }} disabled={cancel.isPending}>
                      <XCircle className="h-4 w-4 mr-1" /> Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <div>
                      <Label>Novo dia</Label>
                      <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
                        {days.map((d) => {
                          const iso = d.toISOString().slice(0, 10);
                          const isSel = iso === day;
                          return (
                            <button key={iso} onClick={() => { setDay(iso); setSlot(""); }}
                              className={`shrink-0 rounded-lg border px-3 py-2 min-w-[70px] text-center ${
                                isSel ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                              }`}>
                              <div className="text-[10px] uppercase text-muted-foreground">{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</div>
                              <div className="font-display text-lg">{d.getDate()}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {day && (
                      <div>
                        <Label>Horário</Label>
                        <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {slots.map((t) => (
                            <button key={t} onClick={() => setSlot(t)}
                              className={`rounded-md border px-2 py-1.5 text-sm ${
                                slot === t ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
                              }`}>{t}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={() => reschedule.mutate()} disabled={!slot || reschedule.isPending}>
                        <Check className="h-4 w-4 mr-1" /> Confirmar novo horário
                      </Button>
                      <Button variant="ghost" onClick={() => { setRescheduling(false); setDay(""); setSlot(""); }}>Voltar</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}
        {aptQ.data && <LoyaltyCard token={token} />}
      </main>
    </div>
  );
}