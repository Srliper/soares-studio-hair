
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Auto profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Professionals
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  bio TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  work_start TIME NOT NULL DEFAULT '09:00',
  work_end TIME NOT NULL DEFAULT '19:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.professionals TO anon, authenticated;
GRANT ALL ON public.professionals TO service_role;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read professionals" ON public.professionals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage professionals" ON public.professionals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Services
CREATE TYPE public.service_category AS ENUM ('masculino', 'feminino', 'noiva', 'manicure', 'outro');

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category service_category NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read services" ON public.services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage services" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Appointments
CREATE TYPE public.appointment_status AS ENUM ('pendente', 'confirmado', 'concluido', 'cancelado');

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_notes TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status appointment_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.appointments (professional_id, start_at);
GRANT SELECT, INSERT ON public.appointments TO anon, authenticated;
GRANT UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a booking
CREATE POLICY "anyone can book" ON public.appointments FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pendente');

-- Public can read only the occupied slot times (not names/phones) via a view — we'll expose limited SELECT via a security definer function instead.
-- For now: only admins can SELECT full appointment data.
CREATE POLICY "admins read appointments" ON public.appointments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete appointments" ON public.appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Public function to fetch only busy time ranges for availability display
CREATE OR REPLACE FUNCTION public.get_busy_slots(_professional_id UUID, _day DATE)
RETURNS TABLE(start_at TIMESTAMPTZ, end_at TIMESTAMPTZ)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT start_at, end_at FROM public.appointments
  WHERE professional_id = _professional_id
    AND status <> 'cancelado'
    AND start_at::date = _day;
$$;
GRANT EXECUTE ON FUNCTION public.get_busy_slots(UUID, DATE) TO anon, authenticated;

-- Seed professionals & services
INSERT INTO public.professionals (slug, name, role_title, bio) VALUES
  ('afonso', 'Afonso Soares', 'Barbeiro & Cabeleireiro', 'Especialista em cortes masculinos, femininos e penteados de noiva.'),
  ('alexia', 'Alexia', 'Manicure', 'Cuidado completo para suas unhas — mãos e pés.');

INSERT INTO public.services (professional_id, name, category, price_cents, duration_minutes, sort_order)
SELECT id, s.name, s.category::service_category, s.price_cents, s.duration, s.sort
FROM public.professionals p, (VALUES
  ('Corte Masculino', 'masculino', 5000, 30, 1),
  ('Corte + Barba', 'masculino', 7500, 45, 2),
  ('Barba', 'masculino', 3500, 20, 3),
  ('Corte Feminino', 'feminino', 8000, 60, 4),
  ('Escova', 'feminino', 6000, 45, 5),
  ('Coloração', 'feminino', 15000, 120, 6),
  ('Hidratação', 'feminino', 7000, 60, 7),
  ('Penteado de Noiva', 'noiva', 25000, 90, 8),
  ('Maquiagem de Noiva', 'noiva', 20000, 60, 9),
  ('Pacote Noiva Completo', 'noiva', 45000, 180, 10)
) AS s(name, category, price_cents, duration, sort)
WHERE p.slug = 'afonso';

INSERT INTO public.services (professional_id, name, category, price_cents, duration_minutes, sort_order)
SELECT id, s.name, s.category::service_category, s.price_cents, s.duration, s.sort
FROM public.professionals p, (VALUES
  ('Manicure', 'manicure', 3500, 45, 1),
  ('Pedicure', 'manicure', 4500, 60, 2),
  ('Mão + Pé', 'manicure', 7000, 90, 3)
) AS s(name, category, price_cents, duration, sort)
WHERE p.slug = 'alexia';
