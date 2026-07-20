
-- 1) Novo valor de papel
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'profissional';

-- 2) Vincular profissional a uma conta de usuário
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS professionals_user_id_unique ON public.professionals(user_id) WHERE user_id IS NOT NULL;

-- 3) Função para checar dono do profissional (evita recursão)
CREATE OR REPLACE FUNCTION public.owns_professional(_prof_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.professionals
    WHERE id = _prof_id AND user_id = auth.uid()
  );
$$;

-- 4) Professionals: dono pode atualizar a própria linha (horários, bio)
DROP POLICY IF EXISTS "owner update own professional" ON public.professionals;
CREATE POLICY "owner update own professional"
ON public.professionals
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5) Services: dono pode inserir/editar/remover apenas os próprios serviços
DROP POLICY IF EXISTS "owner insert own services" ON public.services;
CREATE POLICY "owner insert own services"
ON public.services
FOR INSERT TO authenticated
WITH CHECK (public.owns_professional(professional_id));

DROP POLICY IF EXISTS "owner update own services" ON public.services;
CREATE POLICY "owner update own services"
ON public.services
FOR UPDATE TO authenticated
USING (public.owns_professional(professional_id))
WITH CHECK (public.owns_professional(professional_id));

DROP POLICY IF EXISTS "owner delete own services" ON public.services;
CREATE POLICY "owner delete own services"
ON public.services
FOR DELETE TO authenticated
USING (public.owns_professional(professional_id));
