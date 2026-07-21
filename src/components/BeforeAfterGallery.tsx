import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { GalleryHorizontal } from "lucide-react";
import { categoryLabel, type ServiceCategory } from "@/lib/format";

type Item = {
  id: string;
  professional_id: string;
  category: ServiceCategory;
  title: string | null;
  before_path: string;
  after_path: string;
  professionals: { name: string } | null;
};

export function BeforeAfterGallery() {
  const [proFilter, setProFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<"all" | ServiceCategory>("all");

  const q = useQuery({
    queryKey: ["portfolio-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("id, professional_id, category, title, before_path, after_path, professionals(name)")
        .eq("status", "aprovado")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as Item[];
    },
  });

  const items = q.data ?? [];
  const pros = useMemo(() => {
    const seen = new Map<string, string>();
    items.forEach((i) => {
      if (i.professionals?.name) seen.set(i.professional_id, i.professionals.name);
    });
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [items]);
  const cats = useMemo(() => Array.from(new Set(items.map((i) => i.category))) as ServiceCategory[], [items]);

  const filtered = items.filter(
    (i) => (proFilter === "all" || i.professional_id === proFilter) && (catFilter === "all" || i.category === catFilter),
  );

  if (!q.isLoading && items.length === 0) return null;

  return (
    <section id="galeria" className="border-t border-border/50">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="flex items-center justify-center gap-2 text-primary">
          <GalleryHorizontal className="h-5 w-5" />
          <span className="text-xs uppercase tracking-[0.4em]">Antes & Depois</span>
        </div>
        <h2 className="mt-4 text-center font-display text-4xl md:text-5xl">
          Transformações <span className="italic gold-gradient">reais.</span>
        </h2>
        <p className="mt-3 text-center text-sm text-muted-foreground">Fotos dos nossos clientes, cortadas por quem entende.</p>

        {(pros.length > 1 || cats.length > 1) && (
          <div className="mt-8 flex flex-col items-center gap-3">
            {pros.length > 1 && (
              <div className="flex flex-wrap justify-center gap-2">
                <FilterChip active={proFilter === "all"} onClick={() => setProFilter("all")}>Todos profissionais</FilterChip>
                {pros.map((p) => (
                  <FilterChip key={p.id} active={proFilter === p.id} onClick={() => setProFilter(p.id)}>{p.name}</FilterChip>
                ))}
              </div>
            )}
            {cats.length > 1 && (
              <div className="flex flex-wrap justify-center gap-2">
                <FilterChip active={catFilter === "all"} onClick={() => setCatFilter("all")}>Todos tipos</FilterChip>
                {cats.map((c) => (
                  <FilterChip key={c} active={catFilter === c} onClick={() => setCatFilter(c)}>{categoryLabel[c]}</FilterChip>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => <BeforeAfterCard key={i.id} item={i} />)}
          {q.isLoading && Array.from({ length: 3 }).map((_, k) => (
            <div key={k} className="aspect-[4/3] rounded-lg bg-muted/20 animate-pulse" />
          ))}
        </div>

        {filtered.length === 0 && !q.isLoading && (
          <p className="mt-10 text-center text-sm text-muted-foreground">Nada corresponde aos filtros escolhidos.</p>
        )}
      </div>
    </section>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest transition ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function BeforeAfterCard({ item }: { item: Item }) {
  const { data: urls } = useQuery({
    queryKey: ["portfolio-public-url", item.before_path, item.after_path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("portfolio").createSignedUrls([item.before_path, item.after_path], 3600);
      if (error) throw error;
      return { before: data?.[0]?.signedUrl, after: data?.[1]?.signedUrl };
    },
    staleTime: 30 * 60 * 1000,
  });
  const [reveal, setReveal] = useState(50);
  return (
    <div className="group overflow-hidden rounded-xl border border-border/60 bg-card">
      <div
        className="relative aspect-[4/5] w-full select-none bg-muted/20"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setReveal(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
        }}
        onTouchMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.touches[0].clientX - rect.left;
          setReveal(Math.max(0, Math.min(100, (x / rect.width) * 100)));
        }}
      >
        {urls?.before && <img src={urls.before} alt="Antes" className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
        {urls?.after && (
          <img
            src={urls.after}
            alt="Depois"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ clipPath: `inset(0 0 0 ${reveal}%)` }}
            draggable={false}
          />
        )}
        <div className="absolute inset-y-0 w-px bg-primary" style={{ left: `${reveal}%` }}>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
            ↔
          </div>
        </div>
        <span className="absolute left-2 top-2 rounded-md bg-background/70 px-2 py-0.5 text-[10px] uppercase tracking-widest text-foreground">Antes</span>
        <span className="absolute right-2 top-2 rounded-md bg-background/70 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">Depois</span>
      </div>
      <div className="p-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {item.professionals?.name} · {categoryLabel[item.category]}
        </div>
        {item.title && <div className="mt-1 text-sm text-foreground">{item.title}</div>}
      </div>
    </div>
  );
}