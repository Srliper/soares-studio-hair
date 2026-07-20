
-- =============================================================
-- SECURITY FIXES
-- =============================================================

-- 1) Appointments PII: replace public SELECT with a safe view
DROP POLICY IF EXISTS "public read busy times" ON public.appointments;

CREATE OR REPLACE VIEW public.appointments_busy
WITH (security_invoker = true)
AS
SELECT professional_id, start_at, end_at, status
FROM public.appointments
WHERE status <> 'cancelado'::appointment_status;

GRANT SELECT ON public.appointments_busy TO anon, authenticated;

-- 2) Professionals: hide claim_code from public
DROP POLICY IF EXISTS "public read professionals" ON public.professionals;

CREATE OR REPLACE VIEW public.professionals_public
WITH (security_invoker = true)
AS
SELECT id, slug, name, role_title, bio, active, work_start, work_end
FROM public.professionals
WHERE active = true;

GRANT SELECT ON public.professionals_public TO anon, authenticated;

-- Owners still need to read their own row (admin already covered by ALL policy)
CREATE POLICY "owner select own professional"
ON public.professionals
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3) Tighten "anyone can book" WITH CHECK + validation trigger
DROP POLICY IF EXISTS "anyone can book" ON public.appointments;

CREATE POLICY "anyone can book"
ON public.appointments
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pendente'::appointment_status
  AND client_name IS NOT NULL AND length(btrim(client_name)) BETWEEN 2 AND 120
  AND client_phone IS NOT NULL AND length(regexp_replace(client_phone, '\D', '', 'g')) BETWEEN 8 AND 15
  AND (client_notes IS NULL OR length(client_notes) <= 500)
  AND start_at > now() - interval '1 minute'
  AND start_at < now() + interval '180 days'
  AND end_at > start_at
  AND (end_at - start_at) BETWEEN interval '5 minutes' AND interval '8 hours'
);

CREATE OR REPLACE FUNCTION public.validate_appointment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pro RECORD;
  _svc RECORD;
  _overlap int;
BEGIN
  SELECT id INTO _pro
  FROM public.professionals
  WHERE id = NEW.professional_id AND active = true;
  IF _pro.id IS NULL THEN
    RAISE EXCEPTION 'Profissional inválido ou inativo';
  END IF;

  SELECT id INTO _svc
  FROM public.services
  WHERE id = NEW.service_id AND professional_id = NEW.professional_id AND active = true;
  IF _svc.id IS NULL THEN
    RAISE EXCEPTION 'Serviço inválido para este profissional';
  END IF;

  SELECT count(*) INTO _overlap
  FROM public.appointments
  WHERE professional_id = NEW.professional_id
    AND status <> 'cancelado'::appointment_status
    AND tstzrange(start_at, end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)');
  IF _overlap > 0 THEN
    RAISE EXCEPTION 'Horário indisponível';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_appointment_insert ON public.appointments;
CREATE TRIGGER trg_validate_appointment_insert
BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_insert();

-- 4) SECURITY DEFINER function exposure
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_professional(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_professional(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_regenerate_claim_code(uuid, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_claim_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_unlink_professional(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_appointment_insert() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_professional(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_professional(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_claim_code(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_claim_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlink_professional(uuid) TO authenticated;

-- =============================================================
-- RE-ENGAGEMENT FEATURE
-- =============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone_digits text NOT NULL UNIQUE,
  phone_display text NOT NULL,
  first_visit_at timestamptz NOT NULL DEFAULT now(),
  last_visit_at timestamptz NOT NULL DEFAULT now(),
  total_appointments int NOT NULL DEFAULT 1,
  opted_out boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage customers"
ON public.customers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX customers_last_visit_idx ON public.customers(last_visit_at DESC);

-- Settings (singleton)
CREATE TABLE public.reengagement_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  days_threshold int NOT NULL DEFAULT 45 CHECK (days_threshold BETWEEN 7 AND 365),
  cooldown_days int NOT NULL DEFAULT 30 CHECK (cooldown_days BETWEEN 7 AND 365),
  message_template text NOT NULL DEFAULT 'Olá {{name}}! Faz um tempinho que você não passa pelo Studio Soares. Que tal reservar um novo horário? 💇✨',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.reengagement_settings (id) VALUES (1);

GRANT SELECT, UPDATE ON public.reengagement_settings TO authenticated;
GRANT ALL ON public.reengagement_settings TO service_role;
ALTER TABLE public.reengagement_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage reengagement settings"
ON public.reengagement_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_reengagement_settings_updated BEFORE UPDATE ON public.reengagement_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Events log
CREATE TABLE public.reengagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'n8n',
  status text NOT NULL,
  message text,
  webhook_response text
);

GRANT SELECT ON public.reengagement_events TO authenticated;
GRANT ALL ON public.reengagement_events TO service_role;
ALTER TABLE public.reengagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read reengagement events"
ON public.reengagement_events FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX reengagement_events_customer_idx ON public.reengagement_events(customer_id, sent_at DESC);

-- Auto-populate customers from appointments
CREATE OR REPLACE FUNCTION public.upsert_customer_from_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _digits text := regexp_replace(coalesce(NEW.client_phone, ''), '\D', '', 'g');
BEGIN
  IF _digits = '' THEN RETURN NEW; END IF;
  INSERT INTO public.customers (name, phone_digits, phone_display, first_visit_at, last_visit_at, total_appointments)
  VALUES (NEW.client_name, _digits, NEW.client_phone, NEW.start_at, NEW.start_at, 1)
  ON CONFLICT (phone_digits) DO UPDATE
    SET name = EXCLUDED.name,
        phone_display = EXCLUDED.phone_display,
        last_visit_at = GREATEST(public.customers.last_visit_at, EXCLUDED.last_visit_at),
        total_appointments = public.customers.total_appointments + 1,
        updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_customer_from_appointment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_upsert_customer ON public.appointments;
CREATE TRIGGER trg_upsert_customer
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.upsert_customer_from_appointment();

-- Backfill customers from existing appointments
INSERT INTO public.customers (name, phone_digits, phone_display, first_visit_at, last_visit_at, total_appointments)
SELECT
  min(client_name),
  regexp_replace(client_phone, '\D', '', 'g') AS d,
  min(client_phone),
  min(start_at),
  max(start_at),
  count(*)::int
FROM public.appointments
WHERE client_phone IS NOT NULL
  AND regexp_replace(client_phone, '\D', '', 'g') <> ''
GROUP BY regexp_replace(client_phone, '\D', '', 'g')
ON CONFLICT (phone_digits) DO NOTHING;
