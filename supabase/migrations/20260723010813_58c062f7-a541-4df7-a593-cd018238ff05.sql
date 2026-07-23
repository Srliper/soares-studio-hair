
-- 1) Config table for the webhook shared secret (backend-only)
CREATE TABLE IF NOT EXISTS public.webhook_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.webhook_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.webhook_config TO service_role;

ALTER TABLE public.webhook_config ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated => fully denied through PostgREST

INSERT INTO public.webhook_config (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- 2) Update trigger to send x-webhook-secret instead of anon key
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _url text := 'https://project--49193d63-1f84-4f47-90d2-c4ef6cca206b.lovable.app';
  _secret text;
BEGIN
  IF NEW.status = 'cancelado' AND (OLD.status IS DISTINCT FROM 'cancelado') THEN
    SELECT secret INTO _secret FROM public.webhook_config WHERE id = true;
    IF _secret IS NULL THEN RETURN NEW; END IF;
    PERFORM net.http_post(
      url := _url || '/api/public/hooks/waitlist-slot-freed',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', _secret
      ),
      body := jsonb_build_object('appointment_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$fn$;

-- 3) Reschedule cron jobs with the dedicated secret header
DO $do$
DECLARE
  r RECORD;
  _secret text;
  _base text := 'https://project--49193d63-1f84-4f47-90d2-c4ef6cca206b.lovable.app';
  _headers text;
BEGIN
  SELECT secret INTO _secret FROM public.webhook_config WHERE id = true;
  _headers := format(
    '{"Content-Type": "application/json", "x-webhook-secret": "%s"}',
    _secret
  );

  -- Drop any prior schedules pointing at these hooks
  FOR r IN
    SELECT jobname FROM cron.job
    WHERE jobname ILIKE ANY (ARRAY[
      '%reminder%','%reengag%','%review%','%waitlist%'
    ])
  LOOP
    BEGIN
      PERFORM cron.unschedule(r.jobname);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  -- Reminders every 15 minutes
  PERFORM cron.schedule(
    'hook-reminder-15min',
    '*/15 * * * *',
    format(
      'select net.http_post(url:=%L, headers:=%L::jsonb, body:=%L::jsonb);',
      _base || '/api/public/hooks/reminder',
      _headers,
      '{}'
    )
  );

  -- Re-engagement daily at 10:00
  PERFORM cron.schedule(
    'hook-reengagement-daily',
    '0 10 * * *',
    format(
      'select net.http_post(url:=%L, headers:=%L::jsonb, body:=%L::jsonb);',
      _base || '/api/public/hooks/reengagement',
      _headers,
      '{}'
    )
  );

  -- Review requests hourly
  PERFORM cron.schedule(
    'hook-review-request-hourly',
    '0 * * * *',
    format(
      'select net.http_post(url:=%L, headers:=%L::jsonb, body:=%L::jsonb);',
      _base || '/api/public/hooks/review-request',
      _headers,
      '{}'
    )
  );
END
$do$;

-- 4) Storage: restrict appointment-references uploads to a scoped subpath
DROP POLICY IF EXISTS "anyone upload appointment refs" ON storage.objects;
CREATE POLICY "scoped upload appointment refs" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'appointment-references'
    AND (storage.foldername(name))[1] = 'pending'
    AND name ~ '^pending/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,8}$'
  );
