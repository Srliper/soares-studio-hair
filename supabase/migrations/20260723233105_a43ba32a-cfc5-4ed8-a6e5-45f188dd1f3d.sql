
REVOKE SELECT ON public.professionals FROM anon, authenticated;
GRANT SELECT (id, slug, name, role_title, bio, active, work_start, work_end, user_id)
  ON public.professionals TO anon, authenticated;

DROP POLICY IF EXISTS "public read active professionals" ON public.professionals;
CREATE POLICY "public read active professionals"
  ON public.professionals FOR SELECT
  TO anon, authenticated
  USING (active = true);

REVOKE SELECT ON public.appointments FROM anon, authenticated;
GRANT SELECT (id, professional_id, service_id, start_at, end_at, status)
  ON public.appointments TO anon, authenticated;

DROP POLICY IF EXISTS "public read busy slots" ON public.appointments;
CREATE POLICY "public read busy slots"
  ON public.appointments FOR SELECT
  TO anon, authenticated
  USING (status <> 'cancelado'::appointment_status);
