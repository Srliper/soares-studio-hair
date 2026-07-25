import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Crown, Sparkles, Plus, Edit2, Power, PowerOff, UserPlus, Copy } from "lucide-react";

type Pro = {
  id: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  tiktok_url: string | null;
  active: boolean;
  pinned: boolean;
  role_badge: "chefe" | "cofundadora" | null;
  user_id: string | null;
  claim_code: string | null;
  claim_code_expires_at: string | null;
};

export function TeamPanel() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Pro | null>(null);
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState<{ name: string; code: string } | null>(null);

  const list = useQuery({
    queryKey: ["team-professionals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id,name,bio,photo_url,tiktok_url,active,pinned,role_badge,user_id,claim_code,claim_code_expires_at")
        .order("pinned", { ascending: false })
        .order("active", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as Pro[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (p: Pro) => {
      const { error } = await supabase.from("professionals").update({ active: !p.active }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["team-professionals"] }); },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  const create = useMutation({
    mutationFn: async (input: { name: string; bio: string; photo_url: string; tiktok_url: string }) => {
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const { data, error } = await supabase.from("professionals").insert({
        name: input.name.trim(),
        slug: input.name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6),
        role_title: "Profissional",
        bio: input.bio.trim() || null,
        photo_url: input.photo_url.trim() || null,
        tiktok_url: input.tiktok_url.trim() || null,
        active: true,
        pinned: false,
        claim_code: code,
        claim_code_expires_at: new Date(Date.now() + 168 * 3600 * 1000).toISOString(),
      }).select("name, claim_code").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setCreating(false);
      setNewCode({ name: data.name, code: data.claim_code ?? "" });
      qc.invalidateQueries({ queryKey: ["team-professionals"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar"),
  });

  const update = useMutation({
    mutationFn: async (p: Pro) => {
      const { error } = await supabase.from("professionals").update({
        name: p.name.trim(),
        bio: p.bio?.trim() || null,
        photo_url: p.photo_url?.trim() || null,
        tiktok_url: p.tiktok_url?.trim() || null,
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Salvo"); setEditing(null); qc.invalidateQueries({ queryKey: ["team-professionals"] }); },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  const badge = (b: Pro["role_badge"]) => {
    if (b === "chefe") return <Badge className="bg-primary text-primary-foreground gap-1"><Crown className="h-3 w-3" />Chefe</Badge>;
    if (b === "cofundadora") return <Badge className="bg-primary/80 text-primary-foreground gap-1"><Sparkles className="h-3 w-3" />Co-fundadora</Badge>;
    return null;
  };

  return (
    <div className="space-y-6 mt-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-xl">Equipe</h2>
            <p className="text-sm text-muted-foreground">Adicione, edite ou desative colaboradores. Afonso e Alexia são fixados e não podem ser removidos.</p>
          </div>
          <Button onClick={() => setCreating(true)}><UserPlus className="h-4 w-4 mr-1" />Novo colaborador</Button>
        </div>

        {list.isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(list.data ?? []).map((p) => (
              <div key={p.id} className={`rounded-lg border p-4 flex gap-4 ${p.pinned ? "border-primary/50 bg-primary/5" : "border-border/50"} ${!p.active ? "opacity-60" : ""}`}>
                <div className="h-16 w-16 shrink-0 rounded-full bg-muted overflow-hidden">
                  {p.photo_url ? <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" /> : <div className="h-full w-full grid place-items-center text-xs text-muted-foreground">Sem foto</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium truncate">{p.name}</div>
                    {badge(p.role_badge)}
                    {!p.active && <Badge variant="outline">Inativo</Badge>}
                    {!p.user_id && <Badge variant="outline" className="text-xs">Sem conta vinculada</Badge>}
                  </div>
                  {p.bio && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.bio}</div>}
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Edit2 className="h-3 w-3 mr-1" />Editar</Button>
                    {!p.pinned && (
                      <Button size="sm" variant="outline" onClick={() => toggleActive.mutate(p)}>
                        {p.active ? <><PowerOff className="h-3 w-3 mr-1" />Desativar</> : <><Power className="h-3 w-3 mr-1" />Reativar</>}
                      </Button>
                    )}
                    {p.claim_code && !p.user_id && (
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(p.claim_code!); toast.success("Código copiado"); }}>
                        <Copy className="h-3 w-3 mr-1" />Código: <span className="font-mono ml-1">{p.claim_code}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <CreateDialog open={creating} onOpenChange={setCreating} onSubmit={(v: any) => create.mutate(v)} pending={create.isPending} />
      <EditDialog pro={editing} onClose={() => setEditing(null)} onSave={(p) => update.mutate(p)} pending={update.isPending} />
      <NewCodeDialog data={newCode} onClose={() => setNewCode(null)} />
    </div>
  );
}

function CreateDialog({ open, onOpenChange, onSubmit, pending }: any) {
  const [name, setName] = useState(""); const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState(""); const [tiktok, setTiktok] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setName(""); setBio(""); setPhoto(""); setTiktok(""); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo colaborador</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome*</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
          <div><Label>Bio</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} /></div>
          <div><Label>URL da foto</Label><Input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://…" /></div>
          <div><Label>TikTok (URL)</Label><Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="https://tiktok.com/@…" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={pending || !name.trim()} onClick={() => onSubmit({ name, bio, photo_url: photo, tiktok_url: tiktok })}>
            <Plus className="h-4 w-4 mr-1" />{pending ? "Criando…" : "Criar e gerar código"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ pro, onClose, onSave, pending }: { pro: Pro | null; onClose: () => void; onSave: (p: Pro) => void; pending: boolean }) {
  const [draft, setDraft] = useState<Pro | null>(null);
  if (pro && (!draft || draft.id !== pro.id)) setDraft(pro);
  if (!pro || !draft) return null;
  return (
    <Dialog open={!!pro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar {pro.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} /></div>
          <div><Label>Bio</Label><Textarea value={draft.bio ?? ""} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} maxLength={500} rows={3} /></div>
          <div><Label>URL da foto</Label><Input value={draft.photo_url ?? ""} onChange={(e) => setDraft({ ...draft, photo_url: e.target.value })} /></div>
          <div><Label>TikTok (URL)</Label><Input value={draft.tiktok_url ?? ""} onChange={(e) => setDraft({ ...draft, tiktok_url: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={pending} onClick={() => onSave(draft)}>{pending ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewCodeDialog({ data, onClose }: { data: { name: string; code: string } | null; onClose: () => void }) {
  if (!data) return null;
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Código gerado para {data.name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Envie este código para o colaborador entrar em /admin e vincular a conta. Válido por 7 dias.</p>
        <div className="rounded-md border-2 border-primary/50 bg-primary/10 p-4 text-center">
          <div className="font-mono text-3xl tracking-widest text-primary">{data.code}</div>
        </div>
        <DialogFooter>
          <Button onClick={() => { navigator.clipboard.writeText(data.code); onClose(); }}><Copy className="h-4 w-4 mr-1" />Copiar e fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}