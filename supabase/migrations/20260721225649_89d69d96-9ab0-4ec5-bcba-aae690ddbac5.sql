
DROP POLICY IF EXISTS "portfolio read all" ON storage.objects;
CREATE POLICY "portfolio read all" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'portfolio');

DROP POLICY IF EXISTS "portfolio admin write" ON storage.objects;
CREATE POLICY "portfolio admin write" ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'portfolio' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'portfolio' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "portfolio pro write own folder" ON storage.objects;
CREATE POLICY "portfolio pro write own folder" ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'portfolio'
    AND EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.user_id = auth.uid() AND (storage.foldername(name))[1] = p.id::text
    )
  )
  WITH CHECK (
    bucket_id = 'portfolio'
    AND EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.user_id = auth.uid() AND (storage.foldername(name))[1] = p.id::text
    )
  );
