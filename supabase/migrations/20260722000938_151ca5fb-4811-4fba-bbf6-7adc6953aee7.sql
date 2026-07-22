
-- Review request settings (singleton row id=1)
CREATE TABLE public.review_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  hours_after integer NOT NULL DEFAULT 3 CHECK (hours_after BETWEEN 1 AND 168),
  cooldown_days integer NOT NULL DEFAULT 90 CHECK (cooldown_days BETWEEN 1 AND 365),
  google_review_url text NOT NULL DEFAULT 'https://g.page/r/studio-soares/review',
  message_template text NOT NULL DEFAULT 'Olá {{name}}! Obrigado por vir ao Studio Soares 💇‍♂️✨ Se curtiu o atendimento, ajuda muito deixar sua avaliação no Google: {{url}}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_settings TO authenticated;
GRANT ALL ON public.review_settings TO service_role;
ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_settings admin read" ON public.review_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "review_settings admin write" ON public.review_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.review_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Sent-review log, one row per appointment
CREATE TABLE public.review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  channel text NOT NULL DEFAULT 'n8n',
  message text NOT NULL,
  webhook_response text
);
CREATE INDEX review_events_customer_idx ON public.review_events(customer_id, sent_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_events TO authenticated;
GRANT ALL ON public.review_events TO service_role;
ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_events admin read" ON public.review_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
