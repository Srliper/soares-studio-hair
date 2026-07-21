
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  category service_category NOT NULL DEFAULT 'masculino',
  title text,
  notes text,
  before_path text NOT NULL,
  after_path text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portfolio_items_pro_idx ON public.portfolio_items(professional_id, active, sort_order);
CREATE INDEX IF NOT EXISTS portfolio_items_category_idx ON public.portfolio_items(category, active);

GRANT SELECT ON public.portfolio_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_items TO authenticated;
GRANT ALL ON public.portfolio_items TO service_role;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio public read active" ON public.portfolio_items;
CREATE POLICY "portfolio public read active" ON public.portfolio_items FOR SELECT TO anon USING (active = true);

DROP POLICY IF EXISTS "portfolio auth read" ON public.portfolio_items;
CREATE POLICY "portfolio auth read" ON public.portfolio_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "portfolio admin all" ON public.portfolio_items;
CREATE POLICY "portfolio admin all" ON public.portfolio_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "portfolio pro manage own" ON public.portfolio_items;
CREATE POLICY "portfolio pro manage own" ON public.portfolio_items FOR ALL TO authenticated
  USING (public.owns_professional(professional_id)) WITH CHECK (public.owns_professional(professional_id));

CREATE TRIGGER portfolio_items_set_updated BEFORE UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
