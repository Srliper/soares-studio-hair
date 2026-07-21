import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { GalleryHorizontal, Plus, Trash2, Upload, Check, EyeOff, Clock } from "lucide-react";
import { categoryLabel, type ServiceCategory } from "@/lib/format";

const CATEGORIES: ServiceCategory[] = ["masculino", "feminino", "noiva", "manicure", "maquiagem", "outro"];

type Status = "rascunho" | "aprovado" | "oculto";
const STATUS_LABEL: Record<Status, string> = { rascunho: "Rascunho", aprovado: "Aprovado", oculto: "Oculto" };
const STATUS_STYLE: Record<Status, string> = {
  rascunho: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  aprovado: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  oculto: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
};

export function PortfolioPanel({ restrictToProfessionalId, isAdmin }: { restrictToProfessionalId: string | null; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [proId, setProId] = useState<string>(restrictToProfessionalId ?? "");
  const [category, setCategory] = useState<ServiceCategory>("masculino");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<"all" | Status>("all");

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("portfolio-drafts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "portfolio_items", filter: "status=eq.rascunho" },
        async (payload) => {
          const row: any = payload.new;
          let proName = "Profissional";
          if (row?.professional_id) {
            const { data } = await supabase.from("professionals").select("name").eq("id", row.professional_id).maybeSingle();
            if (data?.name) proName = data.name;
          }
          const toastId = toast.info("Novo rascunho na galeria", {
            duration: 15000,
            description: `${proName} enviou "${row?.title || categoryLabel[row?.category as ServiceCategory] || "novo item"}" para aprovação.`,
            action: {
              label: "Aprovar",
              onClick: async () => {
                const { error } = await supabase.from("portfolio_items").update({ status: "aprovado" }).eq("id", row.id);
                if (error) return toast.error(error.message);
                toast.success("Item aprovado e publicado");
                qc.invalidateQueries({ queryKey: ["portfolio-items"] });
                qc.invalidateQueries({ queryKey: ["portfolio-public"] });
              },
            },
            cancel: {
              label: "Ocultar",
              onClick: async () => {
                const { error } = await supabase.from("portfolio_items").update({ status: "oculto" }).eq("id", row.id);
                if (error) return toast.error(error.message);
                toast.success("Item ocultado");
                qc.invalidateQueries({ queryKey: ["portfolio-items"] });
              },
            },
          });
          void toastId;
          qc.invalidateQueries({ queryKey: ["portfolio-items"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

  const pros = useQuery({
    queryKey: ["portfolio-pros"],
    enabled: !restrictToProfessionalId,
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("id,name").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = useQuery({
    queryKey: ["portfolio-items", restrictToProfessionalId ?? "all", filter],
    queryFn: async () => {
      let q = supabase.from("portfolio_items").select("*, professionals(name)").order("created_at", { ascending: false });
      if (restrictToProfessionalId) q = q.eq("professional_id", restrictToProfessionalId);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function uploadOne(file: File, proTarget: string, kind: "before" | "after") {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${proTarget}/${crypto.randomUUID()}-${kind}.${ext}`;
    const { error } = await supabase.storage.from("portfolio").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
    if (error) throw error;
    return path;
  }

  const create = useMutation({
    mutationFn: async () => {
      const target = restrictToProfessionalId ?? proId;
      if (!target) throw new Error("Escolha um profissional");
      if (!beforeFile || !afterFile) throw new Error("Envie a foto do antes e do depois");
      for (const f of [beforeFile, afterFile]) {
        if (!f.type.startsWith("image/")) throw new Error("Só imagens são permitidas");
        if (f.size > 8 * 1024 * 1024) throw new Error("Imagem acima de 8MB");
      }
      setUploading(true);
      try {
        const [before_path, after_path] = await Promise.all([
          uploadOne(beforeFile, target, "before"),
          uploadOne(afterFile, target, "after"),
        ]);
        const initialStatus: Status = isAdmin ? "aprovado" : "rascunho";
        const { error } = await supabase.from("portfolio_items").insert({
          professional_id: target,
          category,
          title: title.trim() || null,
          notes: notes.trim() || null,
          before_path,
          after_path,
          status: initialStatus,
        });
        if (error) throw error;
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      toast.success(isAdmin ? "Item aprovado e publicado" : "Enviado para aprovação");
      setTitle(""); setNotes(""); setBeforeFile(null); setAfterFile(null);
      qc.invalidateQueries({ queryKey: ["portfolio-items"] });
      qc.invalidateQueries({ queryKey: ["portfolio-public"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao enviar"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("portfolio_items").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio-items"] });
      qc.invalidateQueries({ queryKey: ["portfolio-public"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao atualizar"),
  });

  const del = useMutation({
    mutationFn: async (item: any) => {
      await supabase.storage.from("portfolio").remove([item.before_path, item.after_path]);
      const { error } = await supabase.from("portfolio_items").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["portfolio-items"] });
      qc.invalidateQueries({ queryKey: ["portfolio-public"] });
    },
  });

  return (
    <div className="space-y-6 mt-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <GalleryHorizontal className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl">Novo Antes/Depois</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {!restrictToProfessionalId && (
            <div>
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
            <Label>Tipo de corte</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ServiceCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{categoryLabel[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Foto "Antes"</Label>
            <Input type="file" accept="image/*" onChange={(e) => setBeforeFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label>Foto "Depois"</Label>
            <Input type="file" accept="image/*" onChange={(e) => setAfterFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="md:col-span-2">
            <Label>Título (opcional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex.: Fade degradê com risco" />
          </div>
          <div className="md:col-span-2">
            <Label>Notas (opcional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </div>
        </div>

        <Button className="mt-4" onClick={() => create.mutate()} disabled={uploading || create.isPending}>
          {uploading ? <Upload className="h-4 w-4 mr-1 animate-pulse" /> : <Plus className="h-4 w-4 mr-1" />}
          {uploading ? "Enviando…" : isAdmin ? "Publicar item" : "Enviar para aprovação"}
        </Button>
        {!isAdmin && (
          <p className="mt-2 text-xs text-muted-foreground">Seu item ficará como <strong>rascunho</strong> até um administrador aprovar.</p>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg">Itens da galeria</h3>
          <div className="flex flex-wrap gap-1">
            {(["all", "rascunho", "aprovado", "oculto"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest transition ${
                  filter === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {k === "all" ? "Todos" : STATUS_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        {list.isLoading ? (
          <div className="text-muted-foreground text-sm">Carregando…</div>
        ) : (list.data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum item ainda.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {(list.data ?? []).map((item: any) => (
              <PortfolioItemCard
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                onSetStatus={(status: Status) => setStatus.mutate({ id: item.id, status })}
                onDelete={() => { if (confirm("Remover este item?")) del.mutate(item); }}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PortfolioItemCard({ item, isAdmin, onSetStatus, onDelete }: any) {
  const status = (item.status ?? "rascunho") as Status;
  const { data: urls } = useQuery({
    queryKey: ["portfolio-signed", item.before_path, item.after_path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("portfolio").createSignedUrls([item.before_path, item.after_path], 3600);
      if (error) throw error;
      return { before: data?.[0]?.signedUrl, after: data?.[1]?.signedUrl };
    },
  });
  return (
    <div className={`rounded-lg border p-3 ${status === "aprovado" ? "border-border" : "border-border/40"}`}>
      <div className="grid grid-cols-2 gap-1">
        {urls?.before ? <img src={urls.before} alt="Antes" className="aspect-square rounded object-cover" /> : <div className="aspect-square rounded bg-muted/40" />}
        {urls?.after ? <img src={urls.after} alt="Depois" className="aspect-square rounded object-cover" /> : <div className="aspect-square rounded bg-muted/40" />}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {item.professionals?.name} · {categoryLabel[item.category as ServiceCategory]}
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${STATUS_STYLE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      {item.title && <div className="mt-1 text-sm font-medium">{item.title}</div>}
      <div className="mt-2 flex flex-wrap justify-end gap-1">
        {isAdmin && status !== "aprovado" && (
          <Button variant="ghost" size="sm" onClick={() => onSetStatus("aprovado")} title="Aprovar">
            <Check className="h-4 w-4 mr-1 text-emerald-500" /> Aprovar
          </Button>
        )}
        {status !== "oculto" && (
          <Button variant="ghost" size="sm" onClick={() => onSetStatus("oculto")} title="Ocultar">
            <EyeOff className="h-4 w-4 mr-1 text-muted-foreground" /> Ocultar
          </Button>
        )}
        {status === "oculto" && (
          <Button variant="ghost" size="sm" onClick={() => onSetStatus("rascunho")} title="Voltar para rascunho">
            <Clock className="h-4 w-4 mr-1 text-amber-500" /> Rascunho
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}