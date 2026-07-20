
CREATE TABLE IF NOT EXISTS public.claim_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  professional_name text,
  event text NOT NULL,
  detail text
);

CREATE INDEX IF NOT EXISTS claim_audit_at_idx ON public.claim_audit (at DESC);

GRANT SELECT ON public.claim_audit TO authenticated;
GRANT ALL ON public.claim_audit TO service_role;
ALTER TABLE public.claim_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit" ON public.claim_audit;
CREATE POLICY "Admins can view audit" ON public.claim_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Recreate claim_professional to write audit entries
CREATE OR REPLACE FUNCTION public.claim_professional(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pro_id uuid;
  _pro_name text;
  _row public.claim_attempts%ROWTYPE;
  _max_attempts CONSTANT int := 5;
  _window CONSTANT interval := interval '15 minutes';
  _lockout CONSTANT interval := interval '1 hour';
  _code_norm text := upper(trim(_code));
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO _row FROM public.claim_attempts WHERE user_id = _uid FOR UPDATE;
  IF _row.user_id IS NULL THEN
    INSERT INTO public.claim_attempts (user_id, attempts, window_start)
    VALUES (_uid, 0, now())
    RETURNING * INTO _row;
  END IF;

  IF _row.locked_until IS NOT NULL AND _row.locked_until > now() THEN
    INSERT INTO public.claim_audit (actor_user_id, event, detail)
    VALUES (_uid, 'attempt_blocked', 'Tentativa durante bloqueio ativo');
    RAISE EXCEPTION 'Muitas tentativas. Tente novamente após %', to_char(_row.locked_until AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
  END IF;

  IF _row.window_start + _window < now() THEN
    UPDATE public.claim_attempts SET attempts = 0, window_start = now(), locked_until = NULL WHERE user_id = _uid;
    _row.attempts := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM public.professionals WHERE user_id = _uid) THEN
    INSERT INTO public.claim_audit (actor_user_id, event, detail)
    VALUES (_uid, 'attempt_already_linked', 'Conta já vinculada tentou novo vínculo');
    RAISE EXCEPTION 'Esta conta já está vinculada a um profissional';
  END IF;

  SELECT id, name INTO _pro_id, _pro_name
  FROM public.professionals
  WHERE claim_code = _code_norm
    AND user_id IS NULL
    AND (claim_code_expires_at IS NULL OR claim_code_expires_at > now())
  LIMIT 1;

  IF _pro_id IS NULL THEN
    UPDATE public.claim_attempts
    SET attempts = attempts + 1,
        locked_until = CASE WHEN attempts + 1 >= _max_attempts THEN now() + _lockout ELSE NULL END
    WHERE user_id = _uid;

    IF _row.attempts + 1 >= _max_attempts THEN
      INSERT INTO public.claim_audit (actor_user_id, event, detail)
      VALUES (_uid, 'lockout', format('Bloqueado por 1h após %s tentativas inválidas', _max_attempts));
      RAISE EXCEPTION 'Muitas tentativas inválidas. Conta bloqueada por 1 hora.';
    END IF;

    INSERT INTO public.claim_audit (actor_user_id, event, detail)
    VALUES (_uid, 'attempt_fail', format('Código "%s" inválido/expirado (tentativa %s de %s)', _code_norm, _row.attempts + 1, _max_attempts));
    RAISE EXCEPTION 'Código inválido, expirado ou já utilizado (% de % tentativas)', _row.attempts + 1, _max_attempts;
  END IF;

  UPDATE public.professionals
  SET user_id = _uid, claim_code_expires_at = NULL
  WHERE id = _pro_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'profissional')
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.claim_attempts WHERE user_id = _uid;

  INSERT INTO public.claim_audit (actor_user_id, professional_id, professional_name, event, detail)
  VALUES (_uid, _pro_id, _pro_name, 'claim_success', 'Vínculo concluído com sucesso');

  RETURN _pro_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_professional(text) TO authenticated;

-- Admin action: regenerate code with expiration
CREATE OR REPLACE FUNCTION public.admin_regenerate_claim_code(_pro_id uuid, _hours int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_code text;
  _pro_name text;
BEGIN
  IF NOT public.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'Apenas admin'; END IF;
  IF _hours NOT IN (1, 24, 168) THEN RAISE EXCEPTION 'Duração inválida'; END IF;

  _new_code := upper(substr(md5(random()::text || _pro_id::text || clock_timestamp()::text), 1, 8));

  UPDATE public.professionals
  SET claim_code = _new_code,
      claim_code_expires_at = now() + make_interval(hours => _hours)
  WHERE id = _pro_id
  RETURNING name INTO _pro_name;

  IF _pro_name IS NULL THEN RAISE EXCEPTION 'Profissional não encontrado'; END IF;

  INSERT INTO public.claim_audit (actor_user_id, professional_id, professional_name, event, detail)
  VALUES (_uid, _pro_id, _pro_name, 'code_generated', format('Novo código com validade de %s h', _hours));

  RETURN _new_code;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_claim_code(uuid, int) TO authenticated;

-- Admin action: revoke code now
CREATE OR REPLACE FUNCTION public.admin_revoke_claim_code(_pro_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pro_name text;
BEGIN
  IF NOT public.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'Apenas admin'; END IF;
  UPDATE public.professionals SET claim_code_expires_at = now() - interval '1 second'
  WHERE id = _pro_id RETURNING name INTO _pro_name;
  IF _pro_name IS NULL THEN RAISE EXCEPTION 'Profissional não encontrado'; END IF;
  INSERT INTO public.claim_audit (actor_user_id, professional_id, professional_name, event, detail)
  VALUES (_uid, _pro_id, _pro_name, 'code_revoked', 'Código revogado manualmente');
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_revoke_claim_code(uuid) TO authenticated;

-- Admin action: unlink professional
CREATE OR REPLACE FUNCTION public.admin_unlink_professional(_pro_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _prev_user uuid;
  _pro_name text;
BEGIN
  IF NOT public.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'Apenas admin'; END IF;
  SELECT user_id, name INTO _prev_user, _pro_name FROM public.professionals WHERE id = _pro_id;
  IF _pro_name IS NULL THEN RAISE EXCEPTION 'Profissional não encontrado'; END IF;
  UPDATE public.professionals SET user_id = NULL WHERE id = _pro_id;
  INSERT INTO public.claim_audit (actor_user_id, professional_id, professional_name, event, detail)
  VALUES (_uid, _pro_id, _pro_name, 'unlinked', format('Vínculo removido (conta anterior: %s)', COALESCE(_prev_user::text, 'nenhuma')));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_unlink_professional(uuid) TO authenticated;
