
WITH afonso AS (
  INSERT INTO public.professionals (name, slug, role_title, bio, work_start, work_end)
  VALUES ('Afonso Soares', 'afonso', 'Hair Designer & Barber', 'Especialista em mechas, cortes femininos e barba.', '09:00', '19:00')
  RETURNING id
), alexia AS (
  INSERT INTO public.professionals (name, slug, role_title, bio, work_start, work_end)
  VALUES ('Alexia Soares', 'alexia', 'Manicure, Maquiadora & Noivas', 'Manicure, maquiagem social/festa e dia da noiva.', '09:00', '19:00')
  RETURNING id
)
INSERT INTO public.services (professional_id, name, category, price_cents, duration_minutes, sort_order)
SELECT id, s.name, s.cat::service_category, s.price, s.dur, s.sort FROM afonso, (VALUES
  ('Corte Masculino','masculino',7000,40,1),
  ('Barba','masculino',5000,30,2),
  ('Corte Feminino','feminino',12000,60,3),
  ('Mechas / Morena Iluminada','feminino',35000,180,4)
) AS s(name,cat,price,dur,sort)
UNION ALL
SELECT id, s.name, s.cat::service_category, s.price, s.dur, s.sort FROM alexia, (VALUES
  ('Manicure','manicure',6000,60,1),
  ('Pedicure','manicure',7000,60,2),
  ('Maquiagem Social','outro',15000,60,3),
  ('Dia da Noiva (Cabelo + Maquiagem)','noiva',80000,180,4)
) AS s(name,cat,price,dur,sort);
