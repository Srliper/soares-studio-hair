
-- =========================
-- Wave A — Pacote Noiva
-- =========================

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.wedding_status AS ENUM ('rascunho','ativo','concluido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) wedding_packages
CREATE TABLE public.wedding_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bride_name text NOT NULL,
  bride_phone text NOT NULL,
  event_date date NOT NULL,
  event_location text,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  block_start_at timestamptz NOT NULL,
  block_end_at timestamptz NOT NULL,
  group_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  max_guests int NOT NULL DEFAULT 10,
  notes text,
  status public.wedding_status NOT NULL DEFAULT 'rascunho',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wedding_window_valid CHECK (block_end_at > block_start_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_packages TO authenticated;
GRANT ALL ON public.wedding_packages TO service_role;

ALTER TABLE public.wedding_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages wedding packages"
  ON public.wedding_packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owning professional reads own packages"
  ON public.wedding_packages FOR SELECT TO authenticated
  USING (public.owns_professional(professional_id));

CREATE TRIGGER trg_wedding_packages_updated_at
  BEFORE UPDATE ON public.wedding_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_wedding_packages_prof_date ON public.wedding_packages(professional_id, event_date);

-- 2) wedding_guests
CREATE TABLE public.wedding_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.wedding_packages(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  guest_phone text NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'confirmado',
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  consent_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wedding_guest_window_valid CHECK (end_at > start_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_guests TO authenticated;
GRANT ALL ON public.wedding_guests TO service_role;

ALTER TABLE public.wedding_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages wedding guests"
  ON public.wedding_guests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owning professional reads own wedding guests"
  ON public.wedding_guests FOR SELECT TO authenticated
  USING (public.owns_professional(professional_id));

CREATE TRIGGER trg_wedding_guests_updated_at
  BEFORE UPDATE ON public.wedding_guests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_wedding_guests_package ON public.wedding_guests(package_id);
CREATE INDEX idx_wedding_guests_prof_time ON public.wedding_guests(professional_id, start_at);

-- 3) Public read via token — safe columns only, no PII of other guests
CREATE OR REPLACE FUNCTION public.get_wedding_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _p public.wedding_packages%ROWTYPE; _guests jsonb; _services jsonb;
BEGIN
  SELECT * INTO _p FROM public.wedding_packages WHERE group_token = _token;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Pacote não encontrado'; END IF;
  IF _p.status = 'cancelado' THEN RAISE EXCEPTION 'Pacote cancelado'; END IF;

  -- Busy slots (no names, no phones)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('start_at', start_at, 'end_at', end_at) ORDER BY start_at), '[]'::jsonb)
    INTO _guests
    FROM public.wedding_guests
    WHERE package_id = _p.id AND status <> 'cancelado'::appointment_status;

  -- Services offered by this professional (public info)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes, 'price_cents', s.price_cents
  ) ORDER BY s.name), '[]'::jsonb)
    INTO _services
    FROM public.services s
    WHERE s.professional_id = _p.professional_id AND s.active = true;

  RETURN jsonb_build_object(
    'package', jsonb_build_object(
      'id', _p.id,
      'bride_name', _p.bride_name,
      'event_date', _p.event_date,
      'event_location', _p.event_location,
      'block_start_at', _p.block_start_at,
      'block_end_at', _p.block_end_at,
      'max_guests', _p.max_guests,
      'status', _p.status,
      'notes', _p.notes,
      'professional_id', _p.professional_id
    ),
    'busy_slots', _guests,
    'guests_count', (SELECT count(*) FROM public.wedding_guests WHERE package_id = _p.id AND status <> 'cancelado'::appointment_status),
    'services', _services
  );
END $$;

REVOKE ALL ON FUNCTION public.get_wedding_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wedding_by_token(uuid) TO anon, authenticated;

-- 4) Public booking via token — validates window, overlap, capacity, consent
CREATE OR REPLACE FUNCTION public.book_wedding_guest(
  _token uuid,
  _guest_name text,
  _guest_phone text,
  _service_id uuid,
  _start_at timestamptz,
  _consent boolean,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.wedding_packages%ROWTYPE;
  _svc public.services%ROWTYPE;
  _end timestamptz;
  _overlap int;
  _count int;
  _guest_id uuid;
BEGIN
  IF _consent IS NOT TRUE THEN
    RAISE EXCEPTION 'Consentimento obrigatório';
  END IF;

  IF _guest_name IS NULL OR length(trim(_guest_name)) < 2 OR length(_guest_name) > 120 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;
  IF _guest_phone IS NULL OR length(trim(_guest_phone)) < 8 OR length(_guest_phone) > 32 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;

  SELECT * INTO _p FROM public.wedding_packages WHERE group_token = _token;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Pacote não encontrado'; END IF;
  IF _p.status <> 'ativo' THEN RAISE EXCEPTION 'Pacote não está aceitando agendamentos'; END IF;

  SELECT * INTO _svc FROM public.services
    WHERE id = _service_id AND professional_id = _p.professional_id AND active = true;
  IF _svc.id IS NULL THEN RAISE EXCEPTION 'Serviço inválido'; END IF;

  _end := _start_at + make_interval(mins => _svc.duration_minutes);

  IF _start_at < _p.block_start_at OR _end > _p.block_end_at THEN
    RAISE EXCEPTION 'Horário fora da janela reservada do pacote';
  END IF;

  SELECT count(*) INTO _count FROM public.wedding_guests
    WHERE package_id = _p.id AND status <> 'cancelado'::appointment_status;
  IF _count >= _p.max_guests THEN
    RAISE EXCEPTION 'Pacote lotado';
  END IF;

  SELECT count(*) INTO _overlap FROM public.wedding_guests
    WHERE package_id = _p.id AND status <> 'cancelado'::appointment_status
      AND tstzrange(start_at, end_at, '[)') && tstzrange(_start_at, _end, '[)');
  IF _overlap > 0 THEN RAISE EXCEPTION 'Horário indisponível'; END IF;

  INSERT INTO public.wedding_guests
    (package_id, guest_name, guest_phone, service_id, professional_id,
     start_at, end_at, status, consent_at, notes)
  VALUES
    (_p.id, trim(_guest_name), trim(_guest_phone), _service_id, _p.professional_id,
     _start_at, _end, 'confirmado'::appointment_status, now(), _notes)
  RETURNING id INTO _guest_id;

  RETURN _guest_id;
END $$;

REVOKE ALL ON FUNCTION public.book_wedding_guest(uuid, text, text, uuid, timestamptz, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_wedding_guest(uuid, text, text, uuid, timestamptz, boolean, text) TO anon, authenticated;
