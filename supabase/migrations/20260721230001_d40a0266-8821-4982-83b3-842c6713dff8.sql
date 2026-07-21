
-- Enum de moderação
DO $$ BEGIN
  CREATE TYPE public.portfolio_status AS ENUM ('rascunho', 'aprovado', 'oculto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS status public.portfolio_status NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- Migrar campo antigo `active` (se ainda existir) para status
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='portfolio_items' AND column_name='active') THEN
    UPDATE public.portfolio_items SET status = CASE WHEN active THEN 'aprovado'::public.portfolio_status ELSE 'oculto'::public.portfolio_status END;
  END IF;
END $$;

-- Recriar policies públicas para usar status
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='portfolio_items' LOOP
    EXECUTE format('DROP POLICY %I ON public.portfolio_items', r.policyname);
  END LOOP;
END $$;

-- Público lê somente aprovados
CREATE POLICY "portfolio public read approved" ON public.portfolio_items
  FOR SELECT TO anon, authenticated
  USING (status = 'aprovado');

-- Admin: acesso total
CREATE POLICY "portfolio admin all" ON public.portfolio_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profissional: pode ver e gerenciar os próprios itens (qualquer status)
CREATE POLICY "portfolio pro read own" ON public.portfolio_items
  FOR SELECT TO authenticated
  USING (public.owns_professional(professional_id));

CREATE POLICY "portfolio pro insert own as draft" ON public.portfolio_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.owns_professional(professional_id)
    AND status = 'rascunho'
  );

-- Profissional pode editar/apagar próprios itens, mas não aprovar (garantido pelo trigger)
CREATE POLICY "portfolio pro update own" ON public.portfolio_items
  FOR UPDATE TO authenticated
  USING (public.owns_professional(professional_id))
  WITH CHECK (public.owns_professional(professional_id));

CREATE POLICY "portfolio pro delete own" ON public.portfolio_items
  FOR DELETE TO authenticated
  USING (public.owns_professional(professional_id));

-- Trigger: apenas admin pode marcar como aprovado; registra reviewer
CREATE OR REPLACE FUNCTION public.portfolio_enforce_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'aprovado' AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Apenas admin pode aprovar itens da galeria';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status <> OLD.status THEN
      IF NEW.status = 'aprovado' AND NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Apenas admin pode aprovar itens da galeria';
      END IF;
      NEW.reviewed_by := auth.uid();
      NEW.reviewed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS portfolio_enforce_status_trg ON public.portfolio_items;
CREATE TRIGGER portfolio_enforce_status_trg
  BEFORE INSERT OR UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_enforce_status();

CREATE INDEX IF NOT EXISTS portfolio_items_status_idx ON public.portfolio_items(status);
