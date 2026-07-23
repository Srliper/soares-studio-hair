-- Drop overly permissive public SELECT policies on base tables
DROP POLICY IF EXISTS "public read active professionals" ON public.professionals;
DROP POLICY IF EXISTS "public read busy slots" ON public.appointments;
DROP POLICY IF EXISTS "public read future time blocks (safe cols)" ON public.time_blocks;

-- Revoke direct anon/authenticated SELECT on base tables (admins/profs keep access via their own RLS policies)
REVOKE SELECT ON public.professionals FROM anon, authenticated;
REVOKE SELECT ON public.appointments FROM anon, authenticated;
REVOKE SELECT ON public.time_blocks FROM anon, authenticated;

-- Keep INSERT/UPDATE/DELETE grants intact for policies that allow them
GRANT INSERT ON public.appointments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_blocks TO authenticated;

-- Switch safe views to run as their owner so they bypass base-table RLS while
-- exposing only the non-sensitive columns defined in each view
ALTER VIEW public.professionals_public SET (security_invoker = off);
ALTER VIEW public.appointments_busy    SET (security_invoker = off);
ALTER VIEW public.time_blocks_public   SET (security_invoker = off);

-- Ensure anon/authenticated can read the safe views
GRANT SELECT ON public.professionals_public TO anon, authenticated;
GRANT SELECT ON public.appointments_busy    TO anon, authenticated;
GRANT SELECT ON public.time_blocks_public   TO anon, authenticated;