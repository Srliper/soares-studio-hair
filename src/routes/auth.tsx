import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      navigate({ to: "/admin", replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      if (data.session) {
        toast.success("Conta criada! Peça a um admin para liberar seu acesso.");
        navigate({ to: "/admin", replace: true });
      } else {
        toast.success("Conta criada. Verifique seu email para confirmar.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao site
        </Link>
        <Card className="p-8 border-primary/30 gold-shadow">
          <div className="mb-6 text-center">
            <div className="font-display text-3xl gold-gradient">Painel Admin</div>
            <p className="mt-2 text-sm text-muted-foreground">Ateliê Afonso & Alexia</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full border-primary/40 hover:bg-primary/10"
            onClick={async () => {
              const result = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (result.error) { toast.error("Não foi possível entrar com Google"); return; }
              if (result.redirected) return;
              navigate({ to: "/admin", replace: true });
            }}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6L19 3.7C17.1 2 14.7 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.4 2.6C6 7.2 8.8 5 12 5z"/><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2c-.3 1.4-1.1 2.6-2.3 3.4l3.5 2.7c2.1-1.9 3.6-4.8 3.6-8.3z"/><path fill="#FBBC05" d="M5 14c-.3-.8-.5-1.6-.5-2.5s.2-1.7.5-2.5L1.6 6.4C.6 8 0 9.9 0 12s.6 4 1.6 5.6L5 14z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.9 1.1-3.2 0-5.9-2.2-6.9-5.1L1.6 16.6C3.5 20.4 7.4 23 12 23z"/></svg>
            Continuar com Google
          </Button>
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pw">Senha</Label>
              <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button disabled={loading} type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
            <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="w-full text-xs text-muted-foreground hover:text-primary">
              {mode === "login" ? "Primeiro acesso? Criar conta" : "Já tem conta? Entrar"}
            </button>
          </form>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Apenas usuários com papel de administrador podem gerenciar o sistema.
        </p>
      </div>
    </div>
  );
}
