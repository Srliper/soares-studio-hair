CREATE OR REPLACE FUNCTION public.book_appointment(
  _professional_id uuid, _service_id uuid, _service_variant_id uuid,
  _reference_image_url text, _style_notes text,
  _client_name text, _client_phone text, _client_notes text,
  _start_at timestamptz, _end_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _tok uuid;
BEGIN
  INSERT INTO public.appointments (
    professional_id, service_id, service_variant_id,
    reference_image_url, style_notes,
    client_name, client_phone, client_notes,
    start_at, end_at, status
  ) VALUES (
    _professional_id, _service_id, _service_variant_id,
    _reference_image_url, NULLIF(btrim(_style_notes),''),
    btrim(_client_name), btrim(_client_phone), NULLIF(btrim(_client_notes),''),
    _start_at, _end_at, 'pendente'
  ) RETURNING manage_token INTO _tok;
  RETURN _tok;
END $$;

REVOKE ALL ON FUNCTION public.book_appointment(uuid,uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid,uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) TO anon, authenticated;