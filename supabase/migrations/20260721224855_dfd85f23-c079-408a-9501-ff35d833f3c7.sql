
-- Onda 1: Operação (bloqueios/folgas, reagendar/cancelar por link, lembrete 24h, realtime)

-- 1) Bloqueios de horário / folgas
CREATE TABLE public.time_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_blocks_range_valid CHECK (end_at > start_at),
  CONSTRAINT time_blocks_reason_len CHECK (reason IS NULL OR length(reason) <= 200)
);
CREATE INDEX time_blocks_prof_range_idx ON public.time_blocks (professional_id, start_at, end_at);

GRANT SELECT ON public.time_blocks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.time_blocks TO authenticated;
GRANT ALL ON public.time_blocks TO service_role;

ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

-- Público pode ler bloqueios futuros (para cálculo de horários livres na tela pública)
CREATE POLICY "public read future time blocks" ON public.time_blocks
  FOR SELECT TO anon, authenticated
  USING (end_at > now() - interval '1 day');

CREATE POLICY "admin manage time blocks" ON public.time_blocks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "prof manage own time blocks" ON public.time_blocks
  FOR ALL TO authenticated
  USING (public.owns_professional(professional_id))
  WITH CHECK (public.owns_professional(professional_id));

-- 2) Token de gerenciamento + controle de lembrete
ALTER TABLE public.appointments
  ADD COLUMN manage_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN reminder_sent_at timestamptz,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_reason text;

CREATE UNIQUE INDEX appointments_manage_token_idx ON public.appointments(manage_token);

-- 3) Trigger de validação agora considera bloqueios
CREATE OR REPLACE FUNCTION public.validate_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pro RECORD;
  _svc RECORD;
  _overlap int;
  _blocked int;
BEGIN
  SELECT id INTO _pro FROM public.professionals WHERE id = NEW.professional_id AND active = true;
  IF _pro.id IS NULL THEN RAISE EXCEPTION 'Profissional inválido ou inativo'; END IF;

  SELECT id INTO _svc FROM public.services WHERE id = NEW.service_id AND professional_id = NEW.professional_id AND active = true;
  IF _svc.id IS NULL THEN RAISE EXCEPTION 'Serviço inválido para este profissional'; END IF;

  SELECT count(*) INTO _overlap FROM public.appointments
  WHERE professional_id = NEW.professional_id
    AND status <> 'cancelado'::appointment_status
    AND tstzrange(start_at, end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)');
  IF _overlap > 0 THEN RAISE EXCEPTION 'Horário indisponível'; END IF;

  SELECT count(*) INTO _blocked FROM public.time_blocks
  WHERE professional_id = NEW.professional_id
    AND tstzrange(start_at, end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)');
  IF _blocked > 0 THEN RAISE EXCEPTION 'Horário bloqueado (folga do profissional)'; END IF;

  RETURN NEW;
END;
$$;

-- 4) Ações públicas por token: cancelar e reagendar
CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(_token uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _apt public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO _apt FROM public.appointments WHERE manage_token = _token;
  IF _apt.id IS NULL THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  IF _apt.status = 'cancelado'::appointment_status THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;
  IF _apt.start_at < now() THEN RAISE EXCEPTION 'Não é possível cancelar um horário passado'; END IF;

  UPDATE public.appointments
  SET status = 'cancelado'::appointment_status,
      cancelled_at = now(),
      cancelled_reason = COALESCE(NULLIF(btrim(_reason), ''), 'Cancelado pelo cliente')
  WHERE id = _apt.id;

  RETURN jsonb_build_object('ok', true, 'id', _apt.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_token(_token uuid, _new_start timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _apt public.appointments%ROWTYPE;
  _duration interval;
  _new_end timestamptz;
  _overlap int;
  _blocked int;
BEGIN
  SELECT * INTO _apt FROM public.appointments WHERE manage_token = _token;
  IF _apt.id IS NULL THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  IF _apt.status = 'cancelado'::appointment_status THEN RAISE EXCEPTION 'Agendamento cancelado não pode ser reagendado'; END IF;
  IF _apt.start_at < now() THEN RAISE EXCEPTION 'Não é possível reagendar um horário passado'; END IF;
  IF _new_start < now() + interval '30 minutes' THEN RAISE EXCEPTION 'Escolha um horário com pelo menos 30 minutos de antecedência'; END IF;
  IF _new_start > now() + interval '180 days' THEN RAISE EXCEPTION 'Data muito distante'; END IF;

  _duration := _apt.end_at - _apt.start_at;
  _new_end := _new_start + _duration;

  SELECT count(*) INTO _overlap FROM public.appointments
  WHERE professional_id = _apt.professional_id
    AND id <> _apt.id
    AND status <> 'cancelado'::appointment_status
    AND tstzrange(start_at, end_at, '[)') && tstzrange(_new_start, _new_end, '[)');
  IF _overlap > 0 THEN RAISE EXCEPTION 'Horário indisponível'; END IF;

  SELECT count(*) INTO _blocked FROM public.time_blocks
  WHERE professional_id = _apt.professional_id
    AND tstzrange(start_at, end_at, '[)') && tstzrange(_new_start, _new_end, '[)');
  IF _blocked > 0 THEN RAISE EXCEPTION 'Horário bloqueado (folga do profissional)'; END IF;

  UPDATE public.appointments
  SET start_at = _new_start, end_at = _new_end, reminder_sent_at = NULL
  WHERE id = _apt.id;

  RETURN jsonb_build_object('ok', true, 'id', _apt.id, 'start_at', _new_start, 'end_at', _new_end);
END;
$$;

-- Leitura pública do agendamento pelo token (retorna DTO seguro)
CREATE OR REPLACE FUNCTION public.get_appointment_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id,
    'client_name', a.client_name,
    'start_at', a.start_at,
    'end_at', a.end_at,
    'status', a.status,
    'professional', jsonb_build_object('id', p.id, 'name', p.name),
    'service', jsonb_build_object('id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes, 'price', s.price)
  ) INTO _r
  FROM public.appointments a
  JOIN public.professionals p ON p.id = a.professional_id
  JOIN public.services s ON s.id = a.service_id
  WHERE a.manage_token = _token;
  IF _r IS NULL THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  RETURN _r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointment_by_token(uuid) TO anon, authenticated;

-- 5) Realtime para admin (novos agendamentos / mudanças de status)
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_blocks;

-- 6) Configurações de lembrete (reaproveita padrão de reengagement)
CREATE TABLE public.reminder_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  hours_before integer NOT NULL DEFAULT 24 CHECK (hours_before BETWEEN 1 AND 168),
  message_template text NOT NULL DEFAULT 'Olá {{name}}! Lembrete do seu horário no Studio Soares em {{when}} com {{professional}}. Precisa remarcar ou cancelar? {{manage_link}}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.reminder_settings (id) VALUES (1);

GRANT SELECT, UPDATE ON public.reminder_settings TO authenticated;
GRANT ALL ON public.reminder_settings TO service_role;
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage reminder settings" ON public.reminder_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
