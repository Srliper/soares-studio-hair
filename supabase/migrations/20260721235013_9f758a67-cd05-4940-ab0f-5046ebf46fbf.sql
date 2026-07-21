
-- Trigger functions should not be callable directly by anon/authenticated
REVOKE ALL ON FUNCTION public.notify_waitlist_on_cancel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portfolio_enforce_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_appointment_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_customer_from_appointment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Admin-only SD functions: keep executable only by admins via has_role check inside; revoke broad grants
REVOKE ALL ON FUNCTION public.admin_regenerate_claim_code(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_claim_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_unlink_professional(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_claim_code(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_claim_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlink_professional(uuid) TO authenticated;

-- Claim / role helpers: authenticated only, no anon
REVOKE ALL ON FUNCTION public.claim_professional(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_professional(text) TO authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.owns_professional(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_professional(uuid) TO authenticated;

-- Token-based public RPCs (get/cancel/reschedule appointment, waitlist status): keep anon+authenticated
-- These are intentionally callable without login using an unguessable UUID token.
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
