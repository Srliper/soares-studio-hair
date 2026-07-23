
-- 1) loyalty_rules: restrict public read to authenticated only
DROP POLICY IF EXISTS "Anyone reads loyalty rules" ON public.loyalty_rules;
CREATE POLICY "Authenticated reads loyalty rules" ON public.loyalty_rules
  FOR SELECT TO authenticated USING (true);

-- 2) time_blocks: drop broad policies, expose only safe columns via view
DROP POLICY IF EXISTS "time_blocks auth read" ON public.time_blocks;
DROP POLICY IF EXISTS "public read future time blocks" ON public.time_blocks;

-- Column-restricted access for anon/authenticated (no `reason`)
GRANT SELECT (professional_id, start_at, end_at) ON public.time_blocks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_blocks TO authenticated;
GRANT ALL ON public.time_blocks TO service_role;

CREATE POLICY "public read future time blocks (safe cols)" ON public.time_blocks
  FOR SELECT TO anon, authenticated
  USING (end_at > now() - interval '1 day');

DROP VIEW IF EXISTS public.time_blocks_public;
CREATE VIEW public.time_blocks_public
  WITH (security_invoker = on) AS
  SELECT professional_id, start_at, end_at
    FROM public.time_blocks
   WHERE end_at > now() - interval '1 day';
GRANT SELECT ON public.time_blocks_public TO anon, authenticated;

-- 3) portfolio storage: restrict public read to approved items only
DROP POLICY IF EXISTS "portfolio read all" ON storage.objects;
CREATE POLICY "portfolio read approved only" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'portfolio'
    AND EXISTS (
      SELECT 1 FROM public.portfolio_items pi
       WHERE pi.status = 'aprovado'
         AND (pi.before_path = storage.objects.name OR pi.after_path = storage.objects.name)
    )
  );

-- 4) portfolio storage: fix folder-ownership check (use object name, not p.name)
DROP POLICY IF EXISTS "portfolio pro write own folder" ON storage.objects;
CREATE POLICY "portfolio pro write own folder" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'portfolio'
    AND EXISTS (
      SELECT 1 FROM public.professionals p
       WHERE p.user_id = auth.uid()
         AND (storage.foldername(storage.objects.name))[1] = p.id::text
    )
  )
  WITH CHECK (
    bucket_id = 'portfolio'
    AND EXISTS (
      SELECT 1 FROM public.professionals p
       WHERE p.user_id = auth.uid()
         AND (storage.foldername(storage.objects.name))[1] = p.id::text
    )
  );

-- 5) Convert SECURITY DEFINER views to security_invoker + supporting grants/policies

-- professionals: column-level anon access + row policy
GRANT SELECT (id, slug, name, role_title, bio, active, work_start, work_end)
  ON public.professionals TO anon, authenticated;
GRANT ALL ON public.professionals TO service_role;
DROP POLICY IF EXISTS "public read active professionals" ON public.professionals;
CREATE POLICY "public read active professionals" ON public.professionals
  FOR SELECT TO anon, authenticated
  USING (active = true);

-- appointments: column-level access for busy-slot lookups
GRANT SELECT (professional_id, start_at, end_at, status)
  ON public.appointments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
DROP POLICY IF EXISTS "public read busy slots" ON public.appointments;
CREATE POLICY "public read busy slots" ON public.appointments
  FOR SELECT TO anon, authenticated
  USING (status <> 'cancelado'::appointment_status);

-- loyalty_points: needed by customer_loyalty_summary (admin-only via existing policy)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_points TO authenticated;
GRANT ALL ON public.loyalty_points TO service_role;

ALTER VIEW public.professionals_public SET (security_invoker = on);
ALTER VIEW public.appointments_busy SET (security_invoker = on);
ALTER VIEW public.customer_loyalty_summary SET (security_invoker = on);
GRANT SELECT ON public.professionals_public TO anon, authenticated;
GRANT SELECT ON public.appointments_busy TO anon, authenticated;
GRANT SELECT ON public.customer_loyalty_summary TO authenticated;

-- 6) Lock down SECURITY DEFINER function executability
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.owns_professional(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_waitlist_on_cancel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_loyalty_on_conclude() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.portfolio_enforce_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_customer_from_appointment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_appointment_insert() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_unlink_professional(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_regenerate_claim_code(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_claim_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_loyalty_bonus(text, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_professional(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_unlink_professional(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_claim_code(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_claim_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_loyalty_bonus(text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_professional(text) TO authenticated;

-- Public/token-based RPCs remain callable
REVOKE EXECUTE ON FUNCTION public.book_appointment(uuid, uuid, uuid, text, text, text, text, text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_appointment_by_token(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_waitlist_status(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.leave_waitlist(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_wedding_by_token(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.book_wedding_guest(uuid, text, text, uuid, timestamptz, boolean, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_loyalty_by_token(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, uuid, uuid, text, text, text, text, text, timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointment_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_waitlist_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_waitlist(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_wedding_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_wedding_guest(uuid, text, text, uuid, timestamptz, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_loyalty_by_token(uuid) TO anon, authenticated;
