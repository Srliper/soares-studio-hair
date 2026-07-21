
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS track_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_track_token_key ON public.waitlist(track_token);

CREATE OR REPLACE FUNCTION public.get_waitlist_status(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _w public.waitlist%ROWTYPE; _pos int; _total int; _pro_name text; _svc_name text;
BEGIN
  SELECT * INTO _w FROM public.waitlist WHERE track_token = _token;
  IF _w.id IS NULL THEN RAISE EXCEPTION 'Inscrição não encontrada'; END IF;

  SELECT name INTO _pro_name FROM public.professionals WHERE id = _w.professional_id;
  SELECT name INTO _svc_name FROM public.services WHERE id = _w.service_id;

  IF _w.status = 'aguardando' THEN
    SELECT count(*) INTO _pos FROM public.waitlist
     WHERE professional_id = _w.professional_id
       AND desired_date = _w.desired_date
       AND status = 'aguardando'
       AND created_at <= _w.created_at;
    SELECT count(*) INTO _total FROM public.waitlist
     WHERE professional_id = _w.professional_id
       AND desired_date = _w.desired_date
       AND status = 'aguardando';
  ELSE
    _pos := NULL; _total := NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', _w.id,
    'client_name', _w.client_name,
    'status', _w.status,
    'desired_date', _w.desired_date,
    'created_at', _w.created_at,
    'notified_at', _w.notified_at,
    'notes', _w.notes,
    'position', _pos,
    'total', _total,
    'professional', jsonb_build_object('id', _w.professional_id, 'name', _pro_name),
    'service', jsonb_build_object('id', _w.service_id, 'name', _svc_name)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_waitlist(_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.waitlist SET status = 'cancelado'
   WHERE track_token = _token AND status = 'aguardando';
  IF NOT FOUND THEN RAISE EXCEPTION 'Não foi possível cancelar'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_waitlist_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_waitlist_status(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_waitlist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_waitlist(uuid) TO anon, authenticated;
