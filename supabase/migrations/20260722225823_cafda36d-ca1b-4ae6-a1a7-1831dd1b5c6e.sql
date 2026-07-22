ALTER VIEW public.professionals_public SET (security_invoker=false);
GRANT SELECT ON public.professionals_public TO anon, authenticated;
ALTER VIEW public.appointments_busy SET (security_invoker=false);
GRANT SELECT ON public.appointments_busy TO anon, authenticated;