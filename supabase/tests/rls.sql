-- pgTAP: validate that RLS + column grants block indirect access from
-- unauthenticated (anon) and authenticated-but-unrelated users.
--
-- Runs against the ephemeral CI database after all migrations have been applied.
-- Any "not ok" line fails the workflow.

BEGIN;

SELECT plan(20);

-- ---------- 1. RLS is enabled on every sensitive table ----------
SELECT ok(
  (SELECT relrowsecurity FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relname = t),
  format('RLS enabled on public.%s', t)
) FROM unnest(ARRAY[
  'professionals','appointments','user_roles','time_blocks',
  'waitlist','loyalty_points','portfolio_items','wedding_guests'
]) AS t;

-- ---------- 2. anon must NOT be able to read sensitive columns ----------
SELECT ok(
  NOT has_column_privilege('anon', 'public.professionals', 'claim_code', 'SELECT'),
  'anon cannot SELECT professionals.claim_code'
);

SELECT ok(
  NOT has_column_privilege('anon', 'public.appointments', 'client_phone', 'SELECT'),
  'anon cannot SELECT appointments.client_phone'
);

SELECT ok(
  NOT has_column_privilege('anon', 'public.appointments', 'client_name', 'SELECT'),
  'anon cannot SELECT appointments.client_name'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.user_roles', 'SELECT'),
  'anon cannot SELECT user_roles'
);

-- ---------- 3. anon must NOT be able to escalate privileges ----------
SELECT ok(
  NOT has_table_privilege('anon', 'public.user_roles', 'INSERT'),
  'anon cannot INSERT into user_roles (no role self-assignment)'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.professionals', 'UPDATE'),
  'anon cannot UPDATE professionals'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.professionals', 'DELETE'),
  'anon cannot DELETE professionals'
);

-- ---------- 4. Runtime check: anon SELECT on time_blocks is blocked ----------
-- Either the grant is missing (42501) or the policy filters everything out.
DO $$
DECLARE
  cnt bigint;
  blocked boolean := false;
BEGIN
  BEGIN
    SET LOCAL ROLE anon;
    EXECUTE 'SELECT count(*) FROM public.time_blocks' INTO cnt;
    RESET ROLE;
    blocked := (cnt = 0);
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    blocked := true;
  END;
  PERFORM ok(blocked, 'anon cannot read time_blocks rows');
END $$;

-- ---------- 5. Runtime check: anon INSERT into user_roles raises 42501 ----------
SELECT throws_ok(
  $test$
    SET LOCAL ROLE anon;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (gen_random_uuid(), 'admin');
  $test$,
  '42501',
  NULL,
  'anon INSERT into user_roles is rejected with insufficient_privilege'
);
RESET ROLE;

-- ---------- 6. authenticated cannot cross-tenant read professionals.claim_code ----------
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.professionals', 'claim_code', 'SELECT'),
  'authenticated cannot SELECT professionals.claim_code directly'
);

-- ---------- 7. Public views expose only safe columns ----------
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'professionals_public'
      AND column_name IN ('claim_code','claim_code_expires_at','user_id')
  ),
  'professionals_public view does not expose claim_code / user_id'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointments_busy'
      AND column_name IN ('client_name','client_phone','client_notes','manage_token')
  ),
  'appointments_busy view does not expose client PII / manage_token'
);

SELECT * FROM finish();

ROLLBACK;