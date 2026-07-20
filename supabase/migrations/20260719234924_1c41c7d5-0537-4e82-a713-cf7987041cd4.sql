
DROP VIEW IF EXISTS public.busy_slots;

-- Column-level grant: anon may read ONLY these 3 columns
REVOKE SELECT ON public.appointments FROM anon;
GRANT SELECT (professional_id, start_at, end_at, status) ON public.appointments TO anon;

CREATE POLICY "public read busy times" ON public.appointments FOR SELECT TO anon
  USING (status <> 'cancelado');
