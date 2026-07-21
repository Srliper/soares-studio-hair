
-- Variantes de estilo por serviço (ex: "Degradê navalhado", "Middle part", "Barba italiana")
CREATE TABLE public.service_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  extra_price_cents integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_variants_service ON public.service_variants(service_id) WHERE active;

GRANT SELECT ON public.service_variants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_variants TO authenticated;
GRANT ALL ON public.service_variants TO service_role;

ALTER TABLE public.service_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active variants" ON public.service_variants
  FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "admins read all variants" ON public.service_variants
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage variants" ON public.service_variants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner insert variants" ON public.service_variants
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.services s WHERE s.id = service_id AND public.owns_professional(s.professional_id)));
CREATE POLICY "owner update variants" ON public.service_variants
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.services s WHERE s.id = service_id AND public.owns_professional(s.professional_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.services s WHERE s.id = service_id AND public.owns_professional(s.professional_id)));
CREATE POLICY "owner delete variants" ON public.service_variants
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.services s WHERE s.id = service_id AND public.owns_professional(s.professional_id)));

-- Colunas em appointments para variante escolhida, imagem de referência e observações de estilo
ALTER TABLE public.appointments
  ADD COLUMN service_variant_id uuid REFERENCES public.service_variants(id) ON DELETE SET NULL,
  ADD COLUMN reference_image_url text,
  ADD COLUMN style_notes text;

-- Atualizar política de INSERT para validar novos campos opcionais
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
    AND (reference_image_url IS NULL OR (reference_image_url ~ '^https?://' AND length(reference_image_url) <= 800))
    AND start_at > now() - interval '1 minute'
    AND start_at < now() + interval '180 days'
    AND end_at > start_at
    AND (end_at - start_at) BETWEEN interval '5 minutes' AND interval '8 hours'
  );

-- Storage: políticas para bucket público appointment-references (bucket criado via tool)
-- Upload público (com validação de tamanho/tipo no cliente); leitura pública para o admin ver.
CREATE POLICY "anyone upload appointment refs" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'appointment-references');
CREATE POLICY "anyone read appointment refs" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'appointment-references');
CREATE POLICY "admins delete appointment refs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'appointment-references' AND public.has_role(auth.uid(), 'admin'));

-- Seed de variantes para os serviços masculinos e barba existentes do Afonso
INSERT INTO public.service_variants (service_id, name, description, sort_order)
SELECT s.id, v.name, v.description, v.sort_order
FROM public.services s
CROSS JOIN LATERAL (VALUES
  ('Degradê navalhado', 'Fade bem marcado com transição feita na navalha', 1),
  ('Degradê clássico', 'Fade suave, transição gradual na máquina', 2),
  ('Middle part', 'Corte com risca ao meio, estilo moderno', 3),
  ('Social/executivo', 'Corte tradicional discreto', 4),
  ('Undercut', 'Laterais raspadas com topo mais longo', 5),
  ('Cabelo + design', 'Corte com desenho/risca decorativa', 6)
) AS v(name, description, sort_order)
WHERE s.category = 'masculino' AND lower(s.name) LIKE '%cabelo%';

INSERT INTO public.service_variants (service_id, name, description, sort_order)
SELECT s.id, v.name, v.description, v.sort_order
FROM public.services s
CROSS JOIN LATERAL (VALUES
  ('Barba espartana', 'Bem cheia e longa, contornos definidos', 1),
  ('Barba italiana', 'Formato quadrado com bigode conectado', 2),
  ('Barba lenhador', 'Cheia e volumosa, com contorno natural', 3),
  ('Barba desenhada com degradê', 'Contorno com fade suave nas laterais', 4),
  ('Bigode + cavanhaque', 'Estilo tradicional, sem barba lateral', 5)
) AS v(name, description, sort_order)
WHERE s.category = 'masculino' AND lower(s.name) LIKE '%barba%';
