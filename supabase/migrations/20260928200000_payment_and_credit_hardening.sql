-- Payment + credit hardening.
--
-- 1. purchase_events.kind must accept 'full_access'. This was already patched
--    directly on the live database (migration 20260706233134
--    purchase_events_allow_full_access_kind) but never committed, so a database
--    rebuilt from this repo would reject every $19.99 purchase record.
--
-- 2. fulfill_purchase(): records the Stripe session and grants modes/credits in
--    ONE transaction. Previously the webhook granted first and then inserted the
--    purchase_events row without checking the result, so a failed insert left no
--    idempotency record and a Stripe redelivery would grant credits twice.
--
-- 3. consume_generation_credit() / refund_generation_credit(): atomically
--    reserve a credit BEFORE calling the image model. Previously the check and
--    the increment were separate calls, so simultaneous generations could all
--    pass the check and overshoot the host's limit.
--
-- 4. Lock down SECURITY DEFINER functions that were executable by anyone with
--    the public anon key. grant_game_modes / grant_generation_credits let any
--    visitor unlock full access for free from the browser console, and
--    increment_generation_count let anyone burn another host's credits.

ALTER TABLE purchase_events DROP CONSTRAINT IF EXISTS purchase_events_kind_check;
ALTER TABLE purchase_events ADD CONSTRAINT purchase_events_kind_check
  CHECK (kind IN ('game_mode', 'game_mode_bundle', 'credits', 'full_access'));

-- Returns true if this call fulfilled the session, false if it had already been
-- fulfilled (Stripe redelivery). Any failure raises and rolls everything back,
-- so the webhook returns 500 and Stripe retries cleanly.
CREATE OR REPLACE FUNCTION fulfill_purchase(
  p_stripe_session_id text,
  p_host_id uuid,
  p_kind text,
  p_modes text[],
  p_credits integer,
  p_amount_cents integer,
  p_payment_intent_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO purchase_events (host_id, stripe_session_id, stripe_payment_intent_id, kind, detail, amount_cents)
  VALUES (
    p_host_id,
    p_stripe_session_id,
    p_payment_intent_id,
    p_kind,
    jsonb_build_object('modes', to_jsonb(COALESCE(p_modes, ARRAY[]::text[])), 'credits', p_credits),
    p_amount_cents
  )
  ON CONFLICT (stripe_session_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_modes IS NOT NULL AND array_length(p_modes, 1) > 0 THEN
    PERFORM grant_game_modes(p_host_id, p_modes, p_payment_intent_id);
  END IF;

  IF p_credits > 0 THEN
    PERFORM grant_generation_credits(p_host_id, p_credits);
  END IF;

  RETURN true;
END;
$$;

-- Atomically reserves one generation for the host. The row lock taken by the
-- conditional UPDATE serializes concurrent calls for the same host, so the
-- limit can never be exceeded.
CREATE OR REPLACE FUNCTION consume_generation_credit(p_user_id uuid)
RETURNS TABLE(allowed boolean, current_count bigint, max_limit integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_current bigint;
  v_is_admin boolean := has_role(p_user_id, 'admin'::app_role);
BEGIN
  INSERT INTO image_generation_stats (user_id, total_generations, updated_at)
  VALUES (p_user_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  IF v_is_admin THEN
    v_limit := 2147483647;
  ELSE
    SELECT generation_limit INTO v_limit FROM user_game_stats WHERE host_id = p_user_id;
    v_limit := COALESCE(v_limit, 100);
  END IF;

  UPDATE image_generation_stats
  SET total_generations = total_generations + 1,
      updated_at = now()
  WHERE user_id = p_user_id
    AND (v_is_admin OR total_generations < v_limit)
  RETURNING total_generations INTO v_current;

  IF v_current IS NULL THEN
    SELECT total_generations INTO v_current FROM image_generation_stats WHERE user_id = p_user_id;
    RETURN QUERY SELECT false, v_current, v_limit, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_current, v_limit, GREATEST(0, v_limit - v_current)::integer;
END;
$$;

-- Gives back a reserved generation when the image model call fails.
CREATE OR REPLACE FUNCTION refund_generation_credit(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE image_generation_stats
  SET total_generations = GREATEST(0, total_generations - 1),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Only the edge functions (service role) may call these.
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'grant_game_modes(uuid, text[], text)',
    'grant_generation_credits(uuid, integer)',
    'increment_generation_count(uuid)',
    'fulfill_purchase(text, uuid, text, text[], integer, integer, text)',
    'consume_generation_credit(uuid)',
    'refund_generation_credit(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END;
$$;
