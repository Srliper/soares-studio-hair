
-- =========================
-- Wave B — Loyalty / Gamification
-- =========================

DO $$ BEGIN
  CREATE TYPE public.loyalty_source AS ENUM ('appointment','review','referral','bonus','redeem');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) loyalty_rules (singleton row)
CREATE TABLE public.loyalty_rules (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  points_per_real numeric(6,2) NOT NULL DEFAULT 1.0,
  points_per_review int NOT NULL DEFAULT 50,
  redeem_ratio numeric(6,2) NOT NULL DEFAULT 100.0, -- pontos por 1 real de desconto
  celebration_thresholds int[] NOT NULL DEFAULT ARRAY[100, 300, 600, 1000, 2000],
  points_expire_months int NOT NULL DEFAULT 12,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_rules TO anon, authenticated;
GRANT INSERT, UPDATE ON public.loyalty_rules TO authenticated;
GRANT ALL ON public.loyalty_rules TO service_role;

ALTER TABLE public.loyalty_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads loyalty rules"
  ON public.loyalty_rules FOR SELECT USING (true);

CREATE POLICY "Admin edits loyalty rules"
  ON public.loyalty_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.loyalty_rules (id) VALUES (true) ON CONFLICT DO NOTHING;

-- 2) loyalty_points (append-only ledger)
CREATE TABLE public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone_digits text NOT NULL,
  points int NOT NULL, -- positive = earned; negative = redeemed
  source public.loyalty_source NOT NULL,
  source_id uuid,
  note text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.loyalty_points TO authenticated;
GRANT ALL ON public.loyalty_points TO service_role;

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages points"
  ON public.loyalty_points FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_loyalty_points_phone ON public.loyalty_points(customer_phone_digits);
CREATE INDEX idx_loyalty_points_source ON public.loyalty_points(source, source_id);
CREATE UNIQUE INDEX uniq_loyalty_source_id ON public.loyalty_points(source, source_id)
  WHERE source_id IS NOT NULL AND source IN ('appointment','review');

-- 3) Summary view
CREATE OR REPLACE VIEW public.customer_loyalty_summary
WITH (security_invoker = true) AS
SELECT
  lp.customer_phone_digits AS phone_digits,
  COALESCE(SUM(lp.points) FILTER (WHERE lp.expires_at IS NULL OR lp.expires_at > now()), 0)::int AS balance,
  COALESCE(SUM(lp.points) FILTER (WHERE lp.points > 0), 0)::int AS lifetime_earned,
  MAX(lp.created_at) AS last_activity_at
FROM public.loyalty_points lp
GROUP BY lp.customer_phone_digits;

GRANT SELECT ON public.customer_loyalty_summary TO authenticated;
GRANT ALL ON public.customer_loyalty_summary TO service_role;

-- 4) Trigger: credit points on appointment concluded
CREATE OR REPLACE FUNCTION public.credit_loyalty_on_conclude()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _digits text;
  _rules public.loyalty_rules%ROWTYPE;
  _price int;
  _points int;
  _months int;
BEGIN
  IF NEW.status <> 'concluido'::appointment_status THEN RETURN NEW; END IF;
  IF OLD.status = 'concluido'::appointment_status THEN RETURN NEW; END IF;

  _digits := regexp_replace(coalesce(NEW.client_phone, ''), '\D', '', 'g');
  IF _digits = '' THEN RETURN NEW; END IF;

  SELECT * INTO _rules FROM public.loyalty_rules WHERE id = true;
  IF NOT _rules.enabled THEN RETURN NEW; END IF;

  SELECT price_cents INTO _price FROM public.services WHERE id = NEW.service_id;
  IF _price IS NULL OR _price <= 0 THEN RETURN NEW; END IF;

  _points := floor((_price::numeric / 100.0) * _rules.points_per_real)::int;
  IF _points <= 0 THEN RETURN NEW; END IF;

  _months := COALESCE(_rules.points_expire_months, 12);

  INSERT INTO public.loyalty_points (customer_phone_digits, points, source, source_id, note, expires_at)
  VALUES (_digits, _points, 'appointment', NEW.id,
          format('Serviço concluído (agendamento %s)', substr(NEW.id::text, 1, 8)),
          now() + make_interval(months => _months))
  ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL AND source IN ('appointment','review') DO NOTHING;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.credit_loyalty_on_conclude() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_credit_loyalty_on_conclude ON public.appointments;
CREATE TRIGGER trg_credit_loyalty_on_conclude
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.credit_loyalty_on_conclude();

-- 5) Public helper: read loyalty snapshot by appointment token
CREATE OR REPLACE FUNCTION public.get_loyalty_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _digits text;
  _balance int;
  _lifetime int;
  _history jsonb;
  _rules public.loyalty_rules%ROWTYPE;
BEGIN
  SELECT regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g')
    INTO _digits
    FROM public.appointments a
   WHERE a.manage_token = _token;

  IF _digits IS NULL OR _digits = '' THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  SELECT * INTO _rules FROM public.loyalty_rules WHERE id = true;

  SELECT COALESCE(SUM(points) FILTER (WHERE expires_at IS NULL OR expires_at > now()), 0)::int,
         COALESCE(SUM(points) FILTER (WHERE points > 0), 0)::int
    INTO _balance, _lifetime
    FROM public.loyalty_points
   WHERE customer_phone_digits = _digits;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO _history
    FROM (
      SELECT points, source, note, created_at, expires_at
      FROM public.loyalty_points
      WHERE customer_phone_digits = _digits
      ORDER BY created_at DESC
      LIMIT 20
    ) t;

  RETURN jsonb_build_object(
    'enabled', COALESCE(_rules.enabled, false),
    'balance', _balance,
    'lifetime_earned', _lifetime,
    'thresholds', COALESCE(_rules.celebration_thresholds, ARRAY[]::int[]),
    'redeem_ratio', COALESCE(_rules.redeem_ratio, 100.0),
    'history', _history
  );
END $$;

REVOKE ALL ON FUNCTION public.get_loyalty_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_loyalty_by_token(uuid) TO anon, authenticated;

-- 6) Admin RPC: grant bonus points manually
CREATE OR REPLACE FUNCTION public.admin_grant_loyalty_bonus(_phone_digits text, _points int, _note text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid; _months int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas admin'; END IF;
  IF _points = 0 THEN RAISE EXCEPTION 'Valor deve ser diferente de zero'; END IF;
  IF _phone_digits IS NULL OR length(_phone_digits) < 8 THEN RAISE EXCEPTION 'Telefone inválido'; END IF;

  SELECT points_expire_months INTO _months FROM public.loyalty_rules WHERE id = true;

  INSERT INTO public.loyalty_points (customer_phone_digits, points, source, note, expires_at)
  VALUES (regexp_replace(_phone_digits, '\D', '', 'g'),
          _points,
          CASE WHEN _points > 0 THEN 'bonus'::loyalty_source ELSE 'redeem'::loyalty_source END,
          COALESCE(_note, ''),
          CASE WHEN _points > 0 THEN now() + make_interval(months => COALESCE(_months, 12)) ELSE NULL END)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.admin_grant_loyalty_bonus(text, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_loyalty_bonus(text, int, text) TO authenticated;
