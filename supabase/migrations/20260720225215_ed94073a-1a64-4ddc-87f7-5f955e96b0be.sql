
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS claim_code text UNIQUE;

UPDATE public.professionals
SET claim_code = upper(substr(md5(random()::text || id::text), 1, 8))
WHERE claim_code IS NULL;

CREATE OR REPLACE FUNCTION public.claim_professional(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pro_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id INTO _pro_id
  FROM public.professionals
  WHERE claim_code = upper(trim(_code)) AND user_id IS NULL
  LIMIT 1;

  IF _pro_id IS NULL THEN
    RAISE EXCEPTION 'Código inválido ou já utilizado';
  END IF;

  -- Impede que a mesma conta vincule mais de um profissional
  IF EXISTS (SELECT 1 FROM public.professionals WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'Esta conta já está vinculada a um profissional';
  END IF;

  UPDATE public.professionals SET user_id = _uid WHERE id = _pro_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'profissional')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _pro_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_professional(text) TO authenticated;
