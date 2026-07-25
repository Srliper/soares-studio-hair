-- Add role badge + pinned flag to professionals
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS role_badge text CHECK (role_badge IN ('chefe','cofundadora')),
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url text;

-- Mark Afonso and Alexia
UPDATE public.professionals
  SET role_badge = 'chefe', pinned = true
  WHERE lower(name) LIKE 'afonso%';
UPDATE public.professionals
  SET role_badge = 'cofundadora', pinned = true
  WHERE lower(name) LIKE 'alexia%';

-- Block deactivate/delete on pinned rows
CREATE OR REPLACE FUNCTION public.protect_pinned_professional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.pinned THEN
    RAISE EXCEPTION 'Não é possível remover um profissional fixado (%).', OLD.name;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.pinned AND NEW.active = false AND OLD.active = true THEN
    RAISE EXCEPTION 'Não é possível desativar um profissional fixado (%).', OLD.name;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.pinned AND NEW.pinned = false
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas admin pode desafixar profissionais';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_protect_pinned_professional ON public.professionals;
CREATE TRIGGER trg_protect_pinned_professional
BEFORE UPDATE OR DELETE ON public.professionals
FOR EACH ROW EXECUTE FUNCTION public.protect_pinned_professional();

-- Admin can insert/update/delete professionals
DROP POLICY IF EXISTS "admin manages professionals" ON public.professionals;
CREATE POLICY "admin manages professionals" ON public.professionals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));