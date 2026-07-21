
DROP FUNCTION IF EXISTS public.get_appointment_by_token(uuid);
DROP FUNCTION IF EXISTS public.cancel_appointment_by_token(uuid);
DROP FUNCTION IF EXISTS public.cancel_appointment_by_token(uuid, text);
DROP FUNCTION IF EXISTS public.reschedule_appointment_by_token(uuid, timestamptz);

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS manage_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS appointments_manage_token_idx ON public.appointments(manage_token);

CREATE TABLE IF NOT EXISTS public.time_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS time_blocks_pro_start_idx ON public.time_blocks(professional_id, start_at);

GRANT SELECT ON public.time_blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_blocks TO authenticated;
GRANT ALL ON public.time_blocks TO service_role;
ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_blocks anon read" ON public.time_blocks;
CREATE POLICY "time_blocks anon read" ON public.time_blocks FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "time_blocks auth read" ON public.time_blocks;
CREATE POLICY "time_blocks auth read" ON public.time_blocks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "time_blocks admin all" ON public.time_blocks;
CREATE POLICY "time_blocks admin all" ON public.time_blocks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "time_blocks pro manage own" ON public.time_blocks;
CREATE POLICY "time_blocks pro manage own" ON public.time_blocks FOR ALL TO authenticated
  USING (public.owns_professional(professional_id)) WITH CHECK (public.owns_professional(professional_id));

CREATE TABLE IF NOT EXISTS public.reminder_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT false,
  hours_before integer NOT NULL DEFAULT 24,
  message_template text NOT NULL DEFAULT 'Olá {{name}}! Lembrete do seu horário no Studio Soares: {{service}} com {{professional}} em {{when}}. Precisa remarcar ou cancelar? {{manage_link}}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO public.reminder_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT, UPDATE ON public.reminder_settings TO authenticated;
GRANT ALL ON public.reminder_settings TO service_role;
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reminder_settings admin" ON public.reminder_settings;
CREATE POLICY "reminder_settings admin" ON public.reminder_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_appointment_by_token(_token uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _r jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id, 'client_name', a.client_name,
    'start_at', a.start_at, 'end_at', a.end_at, 'status', a.status,
    'professional', jsonb_build_object('id', p.id, 'name', p.name),
    'service', jsonb_build_object('id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes, 'price', s.price_cents)
  ) INTO _r
  FROM public.appointments a
  JOIN public.professionals p ON p.id = a.professional_id
  JOIN public.services s ON s.id = a.service_id
  WHERE a.manage_token = _token;
  IF _r IS NULL THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  RETURN _r;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.appointments SET status = 'cancelado' WHERE manage_token = _token AND status <> 'cancelado';
  IF NOT FOUND THEN RAISE EXCEPTION 'Não foi possível cancelar'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_token(_token uuid, _new_start timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _a public.appointments%ROWTYPE; _dur int; _new_end timestamptz; _overlap int; _block int;
BEGIN
  SELECT * INTO _a FROM public.appointments WHERE manage_token = _token;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  IF _a.status = 'cancelado' THEN RAISE EXCEPTION 'Agendamento cancelado'; END IF;
  IF _new_start < now() THEN RAISE EXCEPTION 'Escolha um horário futuro'; END IF;

  SELECT duration_minutes INTO _dur FROM public.services WHERE id = _a.service_id;
  _new_end := _new_start + make_interval(mins => _dur);

  SELECT count(*) INTO _overlap FROM public.appointments
    WHERE professional_id = _a.professional_id AND id <> _a.id AND status <> 'cancelado'
      AND tstzrange(start_at, end_at, '[)') && tstzrange(_new_start, _new_end, '[)');
  IF _overlap > 0 THEN RAISE EXCEPTION 'Horário indisponível'; END IF;

  SELECT count(*) INTO _block FROM public.time_blocks
    WHERE professional_id = _a.professional_id
      AND tstzrange(start_at, end_at, '[)') && tstzrange(_new_start, _new_end, '[)');
  IF _block > 0 THEN RAISE EXCEPTION 'Profissional indisponível neste horário'; END IF;

  UPDATE public.appointments SET start_at = _new_start, end_at = _new_end, reminder_sent_at = NULL WHERE id = _a.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_appointment_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, timestamptz) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_appointment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _pro RECORD; _svc RECORD; _overlap int; _block int;
BEGIN
  SELECT id INTO _pro FROM public.professionals WHERE id = NEW.professional_id AND active = true;
  IF _pro.id IS NULL THEN RAISE EXCEPTION 'Profissional inválido ou inativo'; END IF;

  SELECT id INTO _svc FROM public.services WHERE id = NEW.service_id AND professional_id = NEW.professional_id AND active = true;
  IF _svc.id IS NULL THEN RAISE EXCEPTION 'Serviço inválido para este profissional'; END IF;

  SELECT count(*) INTO _overlap FROM public.appointments
    WHERE professional_id = NEW.professional_id AND status <> 'cancelado'::appointment_status
      AND tstzrange(start_at, end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)');
  IF _overlap > 0 THEN RAISE EXCEPTION 'Horário indisponível'; END IF;

  SELECT count(*) INTO _block FROM public.time_blocks
    WHERE professional_id = NEW.professional_id
      AND tstzrange(start_at, end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)');
  IF _block > 0 THEN RAISE EXCEPTION 'Profissional indisponível neste horário'; END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.time_blocks; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
