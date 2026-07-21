
-- Waitlist table: clients wait for a slot with a specific professional/service on a chosen day
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  desired_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','notificado','convertido','cancelado')),
  notified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.waitlist TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone (unauthenticated) can join the waitlist
CREATE POLICY "Anyone can join waitlist" ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'aguardando'
    AND length(trim(client_name)) BETWEEN 2 AND 120
    AND length(regexp_replace(client_phone, '\D', '', 'g')) BETWEEN 10 AND 15
    AND desired_date >= CURRENT_DATE
  );

-- Admins can do everything
CREATE POLICY "Admins manage waitlist" ON public.waitlist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Professionals can view/manage their own waitlist entries
CREATE POLICY "Professionals view own waitlist" ON public.waitlist
  FOR SELECT TO authenticated
  USING (public.owns_professional(professional_id));

CREATE POLICY "Professionals update own waitlist" ON public.waitlist
  FOR UPDATE TO authenticated
  USING (public.owns_professional(professional_id))
  WITH CHECK (public.owns_professional(professional_id));

CREATE INDEX idx_waitlist_lookup ON public.waitlist (professional_id, service_id, desired_date, status);

CREATE TRIGGER trg_waitlist_updated_at
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: when appointment cancelled, invoke webhook via pg_net to notify waitlist
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url TEXT;
  _key TEXT;
BEGIN
  IF NEW.status = 'cancelado' AND (OLD.status IS DISTINCT FROM 'cancelado') THEN
    SELECT current_setting('app.settings.public_url', true) INTO _url;
    SELECT current_setting('app.settings.publishable_key', true) INTO _key;
    IF _url IS NULL OR _url = '' THEN
      _url := 'https://project--49193d63-1f84-4f47-90d2-c4ef6cca206b.lovable.app';
    END IF;
    IF _key IS NULL OR _key = '' THEN
      _key := 'sb_publishable_j_aUpPVuCIdRJWsjOQ5xJQ_QA7n-4Pc';
    END IF;
    PERFORM net.http_post(
      url := _url || '/api/public/hooks/waitlist-slot-freed',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', _key),
      body := jsonb_build_object('appointment_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_appointments_notify_waitlist
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_waitlist_on_cancel();
