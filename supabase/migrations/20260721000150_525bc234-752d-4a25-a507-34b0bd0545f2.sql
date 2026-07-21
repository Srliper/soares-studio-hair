
DROP POLICY IF EXISTS "anyone can book" ON public.appointments;
CREATE POLICY "anyone can book" ON public.appointments
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pendente'::appointment_status
    AND client_name IS NOT NULL
    AND length(btrim(client_name)) BETWEEN 2 AND 120
    AND client_phone IS NOT NULL
    AND length(regexp_replace(client_phone, '\D', '', 'g')) BETWEEN 8 AND 15
    AND (client_notes IS NULL OR length(client_notes) <= 500)
    AND (style_notes IS NULL OR length(style_notes) <= 500)
    AND (reference_image_url IS NULL OR length(reference_image_url) BETWEEN 1 AND 800)
    AND start_at > now() - interval '1 minute'
    AND start_at < now() + interval '180 days'
    AND end_at > start_at
    AND (end_at - start_at) BETWEEN interval '5 minutes' AND interval '8 hours'
  );

-- Restringir leitura das imagens de referência apenas ao admin/dono do agendamento
DROP POLICY IF EXISTS "anyone read appointment refs" ON storage.objects;
CREATE POLICY "admins read appointment refs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'appointment-references' AND public.has_role(auth.uid(), 'admin'));
