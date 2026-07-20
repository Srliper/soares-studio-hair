
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS claim_code_expires_at timestamptz;

UPDATE public.professionals
SET claim_code_expires_at = now() + interval '24 hours'
WHERE claim_code IS NOT NULL AND claim_code_expires_at IS NULL AND user_id IS NULL;

CREATE TABLE IF NOT EXISTS public.claim_attempts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  attempts int NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);

GRANT SELECT ON public.claim_attempts TO authenticated;
GRANT ALL ON public.claim_attempts TO service_role;
ALTER TABLE public.claim_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own attempts" ON public.claim_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_professional(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pro_id uuid;
  _row public.claim_attempts%ROWTYPE;
  _max_attempts CONSTANT int := 5;
  _window CONSTANT interval := interval '15 minutes';
  _lockout CONSTANT interval := interval '1 hour';
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Rate limit / lockout check
  SELECT * INTO _row FROM public.claim_attempts WHERE user_id = _uid FOR UPDATE;

  IF _row.user_id IS NULL THEN
    INSERT INTO public.claim_attempts (user_id, attempts, window_start)
    VALUES (_uid, 0, now())
    RETURNING * INTO _row;
  END IF;

  IF _row.locked_until IS NOT NULL AND _row.locked_until > now() THEN
    RAISE EXCEPTION 'Muitas tentativas. Tente novamente após %', to_char(_row.locked_until AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
  END IF;

  -- reset window if expired
  IF _row.window_start + _window < now() THEN
    UPDATE public.claim_attempts SET attempts = 0, window_start = now(), locked_until = NULL WHERE user_id = _uid;
    _row.attempts := 0;
  END IF;

  IF EXISTS (SELECT 1 FROM public.professionals WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'Esta conta já está vinculada a um profissional';
  END IF;

  SELECT id INTO _pro_id
  FROM public.professionals
  WHERE claim_code = upper(trim(_code))
    AND user_id IS NULL
    AND (claim_code_expires_at IS NULL OR claim_code_expires_at > now())
  LIMIT 1;

  IF _pro_id IS NULL THEN
    UPDATE public.claim_attempts
    SET attempts = attempts + 1,
        locked_until = CASE WHEN attempts + 1 >= _max_attempts THEN now() + _lockout ELSE NULL END
    WHERE user_id = _uid;

    IF _row.attempts + 1 >= _max_attempts THEN
      RAISE EXCEPTION 'Muitas tentativas inválidas. Conta bloqueada por 1 hora.';
    END IF;
    RAISE EXCEPTION 'Código inválido, expirado ou já utilizado (% de % tentativas)', _row.attempts + 1, _max_attempts;
  END IF;

  UPDATE public.professionals
  SET user_id = _uid, claim_code_expires_at = NULL
  WHERE id = _pro_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'profissional')
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.claim_attempts WHERE user_id = _uid;

  RETURN _pro_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_professional(text) TO authenticated;
