
-- 1) Drop overly-permissive anon read policy on time_blocks
DROP POLICY IF EXISTS "time_blocks anon read" ON public.time_blocks;

-- 2) Lock down SECURITY DEFINER functions: revoke default PUBLIC execute,
--    then grant only to the roles that legitimately need each function.

-- Trigger-only / internal functions: no direct callers
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_waitlist_on_cancel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_loyalty_on_conclude() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portfolio_enforce_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_customer_from_appointment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_appointment_insert() FROM PUBLIC, anon, authenticated;

-- Helpers used by RLS policies; RLS evaluation runs as the calling role,
-- so keep EXECUTE for authenticated only (anon does not need them).
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.owns_professional(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_professional(uuid) TO authenticated;

-- Admin-only RPCs: authenticated admins only (role check inside function).
REVOKE ALL ON FUNCTION public.admin_unlink_professional(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unlink_professional(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_regenerate_claim_code(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_claim_code(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_revoke_claim_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_claim_code(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_grant_loyalty_bonus(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_loyalty_bonus(text, integer, text) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_professional(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_professional(text) TO authenticated;

-- Public token-based RPCs: gated by unguessable UUID tokens; must remain
-- callable by anon and authenticated. Revoke PUBLIC default then grant
-- explicitly so grants are auditable.
REVOKE ALL ON FUNCTION public.get_appointment_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_appointment_by_token(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.cancel_appointment_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.reschedule_appointment_by_token(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, timestamptz) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_waitlist_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_waitlist_status(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.leave_waitlist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_waitlist(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_wedding_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wedding_by_token(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.book_wedding_guest(uuid, text, text, uuid, timestamptz, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_wedding_guest(uuid, text, text, uuid, timestamptz, boolean, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_loyalty_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_loyalty_by_token(uuid) TO anon, authenticated;
