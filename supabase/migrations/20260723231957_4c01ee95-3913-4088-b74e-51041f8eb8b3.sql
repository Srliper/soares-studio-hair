-- Remove public read access on base tables; public site already uses professionals_public and appointments_busy views which expose only non-sensitive columns.
DROP POLICY IF EXISTS "public read active professionals" ON public.professionals;
DROP POLICY IF EXISTS "public read busy slots" ON public.appointments;

-- Ensure authenticated non-admin users can still read their own professional row (already covered by 'owner select own professional') and admins via 'admins read appointments'/'admins manage professionals'.