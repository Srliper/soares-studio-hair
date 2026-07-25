-- Harden Supabase Realtime publication: restrict published columns on tables
-- that hold PII / internal notes so realtime payloads never leak sensitive
-- fields, even if a future SELECT policy is widened. RLS remains the
-- primary access control; this is defense-in-depth on the wire format.

ALTER PUBLICATION supabase_realtime DROP TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments
  (id, professional_id, service_id, service_variant_id,
   start_at, end_at, status, created_at, cancelled_at, reminder_sent_at);

ALTER PUBLICATION supabase_realtime DROP TABLE public.waitlist;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waitlist
  (id, professional_id, service_id, desired_date, status,
   notified_at, created_at, updated_at);

ALTER PUBLICATION supabase_realtime DROP TABLE public.portfolio_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_items
  (id, professional_id, category, active, sort_order, status,
   created_at, updated_at, reviewed_at);

ALTER PUBLICATION supabase_realtime DROP TABLE public.time_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_blocks
  (id, professional_id, start_at, end_at, created_at);