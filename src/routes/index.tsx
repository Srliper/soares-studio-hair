import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Scissors, Sparkles, Check, ChevronRight, User, Phone, ArrowLeft } from "lucide-react";
import { formatPrice, categoryLabel, type ServiceCategory } from "@/lib/format";
import { toast } from "sonner";
import heroImg from "@/assets/hero.jpg";
import pillarHair from "@/assets/pillar-hair.jpg";
import pillarNails from "@/assets/pillar-nails.jpg";
import pillarWeddingNewAsset from "@/assets/pillar-casamentos-new.jpg.asset.json";
import pillarBarberNewAsset from "@/assets/pillar-barber-new.jpg.asset.json";
import collabAlexiaAsset from "@/assets/pillar-casamentos.png.asset.json";
import collabAfonsoAsset from "@/assets/pillar-barber.jpg.asset.json";
const pillarWedding = pillarWeddingNewAsset.url;
const pillarBarber = pillarBarberNewAsset.url;
const afonsoImg = collabAfonsoAsset.url;
const alexiaImg = collabAlexiaAsset.url;

export const Route = createFileRoute("/")({ component: Home });

type Professional = {
  id: string; slug: string; name: string; role_title: string; bio: string | null;
  work_start: string; work_end: string;
};
type Service = {
  id: string; professional_id: string; name: string; category: ServiceCategory;
  price_cents: number; duration_minutes: number;
};

function useProfessionals() {
  return useQuery({
    queryKey: ["professionals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data as Professional[];
    },
  });
}
function useServices(professionalId?: string) {
  return useQuery({
    queryKey: ["services", professionalId],
    enabled: !!professionalId,
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*")
        .eq("professional_id", professionalId!).eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Service[];
    },
  });
}
function useBusySlots(professionalId?: string, day?: string) {
  return useQuery({
    queryKey: ["busy", professionalId, day],
    enabled: !!professionalId && !!day,
    queryFn: async () => {
      const start = new Date(day + "T00:00:00");
      const end = new Date(day + "T23:59:59");
      const { data, error } = await supabase.from("appointments")
        .select("start_at,end_at")
        .eq("professional_id", professionalId!)
        .gte("start_at", start.toISOString())
        .lte("start_at", end.toISOString());
      if (error) throw error;
      return (data ?? []) as { start_at: string; end_at: string }[];
    },
  });
}

function Home() {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [pro, setPro] = useState<Professional | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [day, setDay] = useState<string>("");
  const [slot, setSlot] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setStep(0); setPro(null); setService(null); setDay(""); setSlot("");
    setName(""); setPhone(""); setNotes(""); setDone(false);
  };

  return (
    <div className="min-h-screen">
      <Header />
      {done ? (
        <SuccessScreen onNew={reset} pro={pro!} service={service!} day={day} slot={slot} />
      ) : (
        <>
          {step === 0 && <Hero onStart={() => setStep(1)} />}
          {step === 0 && (
            <Pillars
              onPickPro={(p) => {
                setPro(p);
                setStep(2);
                queueMicrotask(() => {
                  document.getElementById("agendar")?.scrollIntoView({ behavior: "smooth" });
                });
              }}
            />
          )}
          {step === 0 && <Collaborators />}
          <section id="agendar" className="mx-auto max-w-5xl px-4 pb-24">
            <div className="mb-8 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <span className={step >= 1 ? "text-primary" : ""}>Profissional</span> <ChevronRight className="h-3 w-3" />
              <span className={step >= 2 ? "text-primary" : ""}>Serviço</span> <ChevronRight className="h-3 w-3" />
              <span className={step >= 3 ? "text-primary" : ""}>Horário</span> <ChevronRight className="h-3 w-3" />
              <span className={step >= 4 ? "text-primary" : ""}>Confirmação</span>
            </div>
            <AnimatePresence mode="wait">
              {step >= 1 && step <= 4 && (
                <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                  {step === 1 && <StepPro onPick={(p) => { setPro(p); setStep(2); }} />}
                  {step === 2 && pro && (
                    <StepService pro={pro} onBack={() => setStep(1)} onPick={(s) => { setService(s); setStep(3); }} />
                  )}
                  {step === 3 && pro && service && (
                    <StepSlot pro={pro} service={service} day={day} setDay={setDay} slot={slot} setSlot={setSlot}
                      onBack={() => setStep(2)} onNext={() => setStep(4)} />
                  )}
                  {step === 4 && pro && service && (
                    <StepConfirm pro={pro} service={service} day={day} slot={slot} name={name} setName={setName}
                      phone={phone} setPhone={setPhone} notes={notes} setNotes={setNotes} submitting={submitting}
                      onBack={() => setStep(3)}
                      onSubmit={async () => {
                        if (!name.trim() || !phone.trim()) { toast.error("Preencha nome e telefone"); return; }
                        setSubmitting(true);
                        const start = new Date(`${day}T${slot}:00`);
                        const end = new Date(start.getTime() + service.duration_minutes * 60000);
                        const { error } = await supabase.from("appointments").insert({
                          professional_id: pro.id, service_id: service.id,
                          client_name: name, client_phone: phone, client_notes: notes || null,
                          start_at: start.toISOString(), end_at: end.toISOString(), status: "pendente",
                        });
                        setSubmitting(false);
                        if (error) { toast.error("Não foi possível agendar. Tente outro horário."); return; }
                        setDone(true);
                      }} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </>
      )}
      <Footer />
    </div>
  );
}



function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto grid max-w-6xl grid-cols-3 items-center px-4 py-4">
        <div className="text-xs italic tracking-widest text-primary/80">Est. 2023</div>
        <div className="text-center">
          <div className="font-display text-xl md:text-2xl tracking-[0.35em] gold-gradient">STUDIO SOARES</div>
          <div className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-muted-foreground mt-0.5">Hair Afonso &amp; Alexia</div>
        </div>
        <div className="flex justify-end items-center gap-4">
          <a href="https://instagram.com/afonsosoaresstudio" target="_blank" rel="noopener noreferrer" className="text-xs uppercase tracking-widest text-primary hover:text-primary/80">
            Instagram
          </a>
          <Link to="/auth" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-primary">
            Admin
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImg} alt="Interior do Studio Soares" width={1600} height={1000} className="h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-24 md:pt-28 md:pb-32 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.05] max-w-4xl mx-auto">
            <span className="text-foreground">A nobreza em cada</span><br />
            <span className="italic gold-gradient">detalhe.</span>
          </h1>
          <p className="mt-8 max-w-2xl mx-auto text-lg text-muted-foreground">
            Especialistas em mechas, cortes femininos de luxo e a excelência em manicure por Alexia Soares.
          </p>
          <div className="mt-10 flex justify-center">
            <Button size="lg" onClick={onStart} variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground uppercase tracking-[0.25em] px-8 py-6">
              Agendar experiência
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Pillars({ onPickPro }: { onPickPro: (p: Professional) => void }) {
  const { data: pros } = useProfessionals();
  const findBySlug = (slug: string) => pros?.find((p) => p.slug === slug);
  const items: { title: string; img: string; body: string; slug: string }[] = [
    { title: "Hair Design", img: pillarHair, body: "Mechas exclusivas, Morena Iluminada e cortes que definem personalidade. O foco do Afonso é elevar a sua autoestima.", slug: "afonso" },
    { title: "Manicure & Maquiagem", img: pillarNails, body: "Alexia Soares traz delicadeza e precisão para suas unhas — e assina maquiagens social, festa e noiva com o mesmo cuidado.", slug: "alexia" },
    { title: "Casamentos", img: pillarWedding, body: "O dia da noiva completo — cabelo, maquiagem e cuidado nos detalhes, assinado por Alexia Soares.", slug: "alexia" },
    { title: "Barber", img: pillarBarber, body: "Atendimento premium para o público masculino: cortes clássicos, modernos e barba com a assinatura do Afonso.", slug: "afonso" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => {
          const pro = findBySlug(it.slug);
          const disabled = !pro;
          return (
            <motion.button
              key={it.title}
              type="button"
              disabled={disabled}
              onClick={() => pro && onPickPro(pro)}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="group text-left disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={`Agendar ${it.title} com ${pro?.name ?? ""}`}
            >
              <div className="aspect-square w-full overflow-hidden gold-border rounded-sm">
                <img src={it.img} alt={it.title} loading="lazy" width={900} height={900} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <h3 className="mt-6 font-display text-2xl gold-gradient">{it.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
              <div className="mt-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-primary/80 group-hover:text-primary">
                Agendar <ChevronRight className="h-3 w-3" />
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function Collaborators() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <div className="text-center mb-16">
        <div className="text-xs uppercase tracking-[0.4em] text-primary/80">Colaboradores</div>
        <h2 className="mt-4 font-display text-4xl md:text-5xl">
          A trajetória por trás do <span className="italic gold-gradient">Studio.</span>
        </h2>
      </div>

      <div className="grid gap-12 md:grid-cols-2 md:gap-16">
        <ProfileCard
          role="Hair Designer & Fundador"
          name="Afonso Soares"
          image={afonsoImg}
          bio="Especialista em colorimetria, mechas e cortes femininos de alto padrão. Também referência em cortes masculinos clássicos e modernos, com anos de carreira dedicados a elevar a autoestima de cada cliente."
          instagram="@afonsosoaresstudio"
        />
        <ProfileCard
          role="Nail Designer, Maquiadora & Co-fundadora"
          name="Alexia Soares"
          image={alexiaImg}
          bio="Manicure especializada em blindagem, alongamento e spa para as mãos. Também maquiadora profissional — social, festa e o dia da noiva completo. Parceira de vida e profissão do Afonso, juntos deram origem ao Studio Soares."
          instagram="@alexiasoareshair"
        />
      </div>
    </section>
  );
}

function ProfileCard({ role, name, bio, instagram, image }: { role: string; name: string; bio: string; instagram: string; image: string }) {
  return (
    <div>
      <div className="aspect-[4/5] w-full overflow-hidden gold-border rounded-sm">
        <img src={image} alt={name} loading="lazy" width={900} height={1125} className="h-full w-full object-cover" />
      </div>
      <div className="mt-6 text-xs uppercase tracking-[0.3em] text-primary/80">{role}</div>
      <h3 className="mt-3 font-display text-3xl gold-gradient">{name}</h3>
      <div className="mt-3 h-px w-16 bg-primary/40" />
      <p className="mt-5 text-sm leading-relaxed text-muted-foreground max-w-md">{bio}</p>
      <a href={`https://instagram.com/${instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block text-xs uppercase tracking-[0.3em] text-primary hover:text-primary/80">
        Instagram · {instagram}
      </a>
    </div>
  );
}

function StepPro({ onPick }: { onPick: (p: Professional) => void }) {
  const { data, isLoading } = useProfessionals();

  return (
    <div>
      <h2 className="font-display text-3xl mb-6">Com quem você quer agendar?</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {isLoading && <p className="text-muted-foreground">Carregando…</p>}
        {data?.map((p) => (
          <motion.button key={p.id} whileHover={{ y: -4 }} onClick={() => onPick(p)}
            className="text-left rounded-lg border border-border bg-card p-6 transition hover:border-primary/60 hover:gold-shadow">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 gold-border">
                {p.slug === "afonso" ? <Scissors className="h-6 w-6 text-primary" /> : <Sparkles className="h-6 w-6 text-primary" />}
              </div>
              <div className="flex-1">
                <div className="font-display text-xl">{p.name}</div>
                <div className="text-xs uppercase tracking-widest text-primary/80">{p.role_title}</div>
                {p.bio && <p className="mt-2 text-sm text-muted-foreground">{p.bio}</p>}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function StepService({ pro, onBack, onPick }: { pro: Professional; onBack: () => void; onPick: (s: Service) => void }) {
  const { data, isLoading } = useServices(pro.id);
  const grouped = useMemo(() => {
    const g: Record<string, Service[]> = {};
    (data ?? []).forEach((s) => { (g[s.category] ??= []).push(s); });
    return g;
  }, [data]);

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <h2 className="font-display text-3xl mb-6">Escolha o serviço com {pro.name.split(" ")[0]}</h2>
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      <div className="space-y-8">
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <div className="mb-3 text-xs uppercase tracking-widest text-primary/80">{categoryLabel[cat as ServiceCategory]}</div>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((s) => (
                <motion.button key={s.id} whileHover={{ x: 4 }} onClick={() => onPick(s)}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary/60">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" /> {s.duration_minutes} min
                    </div>
                  </div>
                  <div className="font-display text-xl gold-gradient">{formatPrice(s.price_cents)}</div>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepSlot({
  pro, service, day, setDay, slot, setSlot, onBack, onNext,
}: {
  pro: Professional; service: Service;
  day: string; setDay: (d: string) => void;
  slot: string; setSlot: (s: string) => void;
  onBack: () => void; onNext: () => void;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i);
    return d;
  });

  const { data: busy } = useBusySlots(pro.id, day);

  const slots = useMemo(() => {
    if (!day) return [];
    const [sh, sm] = pro.work_start.split(":").map(Number);
    const [eh, em] = pro.work_end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const dur = service.duration_minutes;
    const out: { time: string; available: boolean }[] = [];
    for (let m = startMin; m + dur <= endMin; m += 30) {
      const h = Math.floor(m / 60), mm = m % 60;
      const time = `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      const slotStart = new Date(`${day}T${time}:00`);
      const slotEnd = new Date(slotStart.getTime() + dur * 60000);
      const conflict = (busy ?? []).some((b) => {
        const bs = new Date(b.start_at), be = new Date(b.end_at);
        return slotStart < be && slotEnd > bs;
      });
      const inPast = slotStart < new Date();
      out.push({ time, available: !conflict && !inPast });
    }
    return out;
  }, [day, pro, service, busy]);

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <h2 className="font-display text-3xl mb-6">Escolha o dia e horário</h2>

      <div className="mb-6">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Dia</Label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {days.map((d) => {
            const iso = d.toISOString().slice(0, 10);
            const isSel = iso === day;
            const dow = d.getDay();
            if (dow === 0) return null; // domingo fechado
            return (
              <button key={iso} onClick={() => { setDay(iso); setSlot(""); }}
                className={`shrink-0 rounded-lg border px-4 py-3 text-center min-w-[80px] transition ${
                  isSel ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                }`}>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                </div>
                <div className="font-display text-xl mt-1">{d.getDate()}</div>
                <div className="text-[10px] text-muted-foreground">
                  {d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {day && (
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Horário</Label>
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {slots.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Sem horários disponíveis.</p>}
            {slots.map((s) => (
              <button key={s.time} disabled={!s.available} onClick={() => setSlot(s.time)}
                className={`rounded-md border px-3 py-2 text-sm transition ${
                  slot === s.time ? "border-primary bg-primary text-primary-foreground" :
                  s.available ? "border-border hover:border-primary/50" :
                  "border-border/40 text-muted-foreground/40 line-through cursor-not-allowed"
                }`}>
                {s.time}
              </button>
            ))}
          </div>
        </div>
      )}

      {slot && (
        <Button className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90" size="lg" onClick={onNext}>
          Continuar <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function StepConfirm({
  pro, service, day, slot, name, setName, phone, setPhone, notes, setNotes, submitting, onBack, onSubmit,
}: any) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <h2 className="font-display text-3xl mb-6">Seus dados</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name"><User className="inline h-3 w-3 mr-1" /> Nome completo</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como podemos te chamar" />
          </div>
          <div>
            <Label htmlFor="phone"><Phone className="inline h-3 w-3 mr-1" /> WhatsApp / Telefone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alguma preferência?" />
          </div>
          <Button disabled={submitting} onClick={onSubmit} size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {submitting ? "Confirmando…" : "Confirmar agendamento"}
          </Button>
        </div>
      </div>
      <Card className="p-6 bg-card border-primary/30 gold-shadow h-fit">
        <div className="text-xs uppercase tracking-widest text-primary/80 mb-4">Resumo</div>
        <div className="space-y-3 text-sm">
          <Row label="Profissional" value={pro.name} />
          <Row label="Serviço" value={service.name} />
          <Row label="Duração" value={`${service.duration_minutes} min`} />
          <Row label="Data" value={new Date(day + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} />
          <Row label="Horário" value={slot} />
          <div className="border-t border-border/50 my-4" />
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Total</span>
            <span className="font-display text-3xl gold-gradient">{formatPrice(service.price_cents)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SuccessScreen({ onNew, pro, service, day, slot }: any) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 gold-border">
        <Check className="h-10 w-10 text-primary" />
      </motion.div>
      <h2 className="mt-6 font-display text-4xl gold-gradient">Agendamento recebido!</h2>
      <p className="mt-4 text-muted-foreground">
        Seu horário com <strong className="text-foreground">{pro.name}</strong> para <strong className="text-foreground">{service.name}</strong> em{" "}
        <strong className="text-foreground">{new Date(day + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} às {slot}</strong> foi registrado.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">Em breve entraremos em contato para confirmar.</p>
      <Button onClick={onNew} className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90">Fazer outro agendamento</Button>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50 mt-12">
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h2 className="font-display text-4xl md:text-5xl">
          Sinta a <span className="italic gold-gradient">exclusividade.</span>
        </h2>
        <p className="mt-4 text-xs uppercase tracking-[0.35em] text-muted-foreground">
          São Miguel Arcanjo e Região <span className="text-primary/60 mx-2">•</span> Atendimento personalizado
        </p>
        <div className="mt-10 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">WhatsApp</span>
            <a href="https://wa.me/5515998343669" target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-primary">
              15 99834 3669
            </a>
          </div>
          <span className="hidden md:block h-4 w-px bg-border" />
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">IG</span>
            <a href="https://instagram.com/afonsosoaresstudio" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 underline underline-offset-4">
              @afonsosoaresstudio
            </a>
          </div>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-[1fr_1.2fr] items-center max-w-3xl mx-auto text-left">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Endereço</span>
            <p className="mt-2 text-foreground">R. Cel. Fernando Prestes, 622</p>
            <p className="text-muted-foreground text-sm">Centro — São Miguel Arcanjo, SP</p>
            <a
              href="https://maps.app.goo.gl/vBNDp2VYR9oXP9ti9"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 text-xs uppercase tracking-[0.3em] text-primary hover:text-primary/80 underline underline-offset-4"
            >
              Como chegar →
            </a>
          </div>
          <div className="overflow-hidden rounded-lg border border-border/50 aspect-video">
            <iframe
              title="Localização Studio Soares"
              src="https://www.google.com/maps?q=R.+Cel.+Fernando+Prestes,+622+-+Centro,+S%C3%A3o+Miguel+Arcanjo+-+SP&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
      <div className="border-t border-border/50 py-6 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        © {new Date().getFullYear()} Studio Soares Hair Afonso — Todos os direitos reservados.
      </div>
    </footer>
  );
}

