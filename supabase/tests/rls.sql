-- pgTAP: validate that RLS + column grants block indirect access from
-- unauthenticated (anon) and authenticated-but-unrelated users.
--
-- Runs against the ephemeral CI database after all migrations have been applied.
-- Any "not ok" line fails the workflow.

BEGIN;

SELECT plan(46);

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

-- ---------- 8. anon write policies: only booking/waitlist INSERT allowed ----------
-- anon cannot INSERT appointment as already-confirmed (bypasses status check)
SELECT throws_ok(
  $test$
    SET LOCAL ROLE anon;
    INSERT INTO public.appointments (professional_id, service_id, client_name, client_phone, start_at, end_at, status)
    VALUES (gen_random_uuid(), gen_random_uuid(), 'x', '11999999999', now() + interval '1 day', now() + interval '1 day 30 min', 'confirmado');
  $test$,
  '42501', NULL,
  'anon cannot INSERT appointment with status <> pendente (WITH CHECK enforced)'
);
RESET ROLE;

-- anon has no UPDATE/DELETE grant on appointments
SELECT ok(NOT has_table_privilege('anon','public.appointments','UPDATE'), 'anon has no UPDATE grant on appointments');
SELECT ok(NOT has_table_privilege('anon','public.appointments','DELETE'), 'anon has no DELETE grant on appointments');

-- waitlist: INSERT allowed, UPDATE/DELETE blocked for anon
SELECT ok(has_table_privilege('anon','public.waitlist','INSERT'), 'anon can INSERT waitlist (join queue)');
SELECT ok(NOT has_table_privilege('anon','public.waitlist','UPDATE'), 'anon cannot UPDATE waitlist');
SELECT ok(NOT has_table_privilege('anon','public.waitlist','DELETE'), 'anon cannot DELETE waitlist');

-- services / time_blocks / portfolio_items / user_roles: no anon writes at all
SELECT ok(NOT has_table_privilege('anon','public.services','INSERT'), 'anon cannot INSERT services');
SELECT ok(NOT has_table_privilege('anon','public.services','UPDATE'), 'anon cannot UPDATE services');
SELECT ok(NOT has_table_privilege('anon','public.services','DELETE'), 'anon cannot DELETE services');
SELECT ok(NOT has_table_privilege('anon','public.time_blocks','INSERT'), 'anon cannot INSERT time_blocks');
SELECT ok(NOT has_table_privilege('anon','public.time_blocks','UPDATE'), 'anon cannot UPDATE time_blocks');
SELECT ok(NOT has_table_privilege('anon','public.time_blocks','DELETE'), 'anon cannot DELETE time_blocks');
SELECT ok(NOT has_table_privilege('anon','public.portfolio_items','INSERT'), 'anon cannot INSERT portfolio_items');
SELECT ok(NOT has_table_privilege('anon','public.portfolio_items','UPDATE'), 'anon cannot UPDATE portfolio_items');
SELECT ok(NOT has_table_privilege('anon','public.portfolio_items','DELETE'), 'anon cannot DELETE portfolio_items');
SELECT ok(NOT has_table_privilege('anon','public.user_roles','UPDATE'), 'anon cannot UPDATE user_roles');
SELECT ok(NOT has_table_privilege('anon','public.user_roles','DELETE'), 'anon cannot DELETE user_roles');
SELECT ok(NOT has_table_privilege('anon','public.loyalty_points','INSERT'), 'anon cannot INSERT loyalty_points');

-- ---------- 9. authenticated (non-owner, non-admin) is blocked by RLS ----------
-- Simulate a real authenticated user with a JWT-derived uid that owns nothing.
DO $$
DECLARE
  fake_uid constant text := '00000000-0000-0000-0000-000000000abc';
  blocked boolean;
  msg text;
BEGIN
  -- INSERT service for a professional the user does not own → RLS violation
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', fake_uid), true);
    INSERT INTO public.services (professional_id, name, duration_minutes, price_cents)
    VALUES (gen_random_uuid(), 'hack', 30, 5000);
    blocked := false;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    blocked := true;
  END;
  RESET ROLE;
  PERFORM ok(blocked, 'authenticated non-owner cannot INSERT services (RLS WITH CHECK)');

  -- INSERT time_blocks for random professional → blocked
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', fake_uid), true);
    INSERT INTO public.time_blocks (professional_id, start_at, end_at)
    VALUES (gen_random_uuid(), now(), now() + interval '1 hour');
    blocked := false;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    blocked := true;
  END;
  RESET ROLE;
  PERFORM ok(blocked, 'authenticated non-owner cannot INSERT time_blocks');

  -- INSERT portfolio_items already approved → blocked (must be rascunho + owner)
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', fake_uid), true);
    INSERT INTO public.portfolio_items (professional_id, status)
    VALUES (gen_random_uuid(), 'aprovado');
    blocked := false;
  EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception THEN
    blocked := true;
  END;
  RESET ROLE;
  PERFORM ok(blocked, 'authenticated cannot self-approve portfolio_items');

  -- INSERT user_roles (self-assign admin) → blocked (no INSERT policy for authenticated)
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', fake_uid), true);
    INSERT INTO public.user_roles (user_id, role)
    VALUES (fake_uid::uuid, 'admin');
    blocked := false;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    blocked := true;
  END;
  RESET ROLE;
  PERFORM ok(blocked, 'authenticated cannot self-assign admin role');

  -- UPDATE professionals row they do not own → filtered / blocked (0 rows affected)
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', fake_uid), true);
    UPDATE public.professionals SET name = 'pwned' WHERE id <> '00000000-0000-0000-0000-000000000000';
    GET DIAGNOSTICS msg = ROW_COUNT;
    blocked := (msg = '0');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    blocked := true;
  END;
  RESET ROLE;
  PERFORM ok(blocked, 'authenticated non-owner UPDATE on professionals affects 0 rows');

  -- DELETE appointments as non-admin → blocked
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', fake_uid), true);
    DELETE FROM public.appointments WHERE id <> '00000000-0000-0000-0000-000000000000';
    GET DIAGNOSTICS msg = ROW_COUNT;
    blocked := (msg = '0');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    blocked := true;
  END;
  RESET ROLE;
  PERFORM ok(blocked, 'authenticated non-admin DELETE on appointments affects 0 rows');

  -- INSERT loyalty_points as non-admin → blocked
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', fake_uid), true);
    INSERT INTO public.loyalty_points (customer_phone_digits, points, source)
    VALUES ('11999999999', 999999, 'bonus');
    blocked := false;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    blocked := true;
  END;
  RESET ROLE;
  PERFORM ok(blocked, 'authenticated non-admin cannot INSERT loyalty_points');

  -- UPDATE own profile succeeds → sanity check that policies aren't blanket-denying
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', fake_uid), true);
    INSERT INTO public.profiles (id, full_name) VALUES (fake_uid::uuid, 'self')
      ON CONFLICT (id) DO NOTHING;
    UPDATE public.profiles SET full_name = 'self-updated' WHERE id = fake_uid::uuid;
    GET DIAGNOSTICS msg = ROW_COUNT;
    blocked := (msg::int >= 1);
  EXCEPTION WHEN OTHERS THEN
    blocked := false;
  END;
  RESET ROLE;
  PERFORM ok(blocked, 'authenticated can UPDATE own profile (positive control)');
END $$;

SELECT * FROM finish();

ROLLBACK;