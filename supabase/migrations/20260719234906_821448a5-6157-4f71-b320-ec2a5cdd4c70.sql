
DROP FUNCTION IF EXISTS public.get_busy_slots(UUID, DATE);

CREATE OR REPLACE VIEW public.busy_slots WITH (security_barrier=true, security_invoker=false) AS
SELECT professional_id, start_at, end_at
FROM public.appointments
WHERE status <> 'cancelado';

GRANT SELECT ON public.busy_slots TO anon, authenticated;
