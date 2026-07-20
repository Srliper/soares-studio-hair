
INSERT INTO public.services (professional_id, name, category, price_cents, duration_minutes, sort_order, active)
SELECT p.id, v.name, v.category::public.service_category, v.price_cents, v.duration_minutes, v.sort_order, true
FROM public.professionals p
CROSS JOIN (VALUES
  ('Maquiagem Social', 'maquiagem', 18000, 60, 50),
  ('Maquiagem Festa / Madrinha', 'maquiagem', 25000, 75, 51),
  ('Maquiagem de Noiva', 'maquiagem', 45000, 120, 52),
  ('Maquiagem de Noiva + Prova', 'maquiagem', 60000, 180, 53)
) AS v(name, category, price_cents, duration_minutes, sort_order)
WHERE p.slug = 'alexia'
AND NOT EXISTS (
  SELECT 1 FROM public.services s WHERE s.professional_id = p.id AND s.name = v.name
);
