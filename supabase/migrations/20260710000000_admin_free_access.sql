-- Admins (public.user_roles role = 'admin') get unlimited image-generation
-- credits, bypassing the purchasable generation_limit entirely.
CREATE OR REPLACE FUNCTION check_generation_limit(p_user_id uuid)
RETURNS TABLE(allowed boolean, current_count bigint, max_limit integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current bigint;
  v_limit integer;
BEGIN
  SELECT COALESCE(total_generations, 0)
  INTO v_current
  FROM image_generation_stats
  WHERE user_id = p_user_id;

  IF v_current IS NULL THEN v_current := 0; END IF;

  IF has_role(p_user_id, 'admin'::app_role) THEN
    RETURN QUERY SELECT true, v_current, 2147483647, 2147483647;
    RETURN;
  END IF;

  SELECT COALESCE(generation_limit, 100)
  INTO v_limit
  FROM user_game_stats
  WHERE host_id = p_user_id;

  -- Default to 100 if no stats row exists yet
  IF v_limit IS NULL THEN v_limit := 100; END IF;

  RETURN QUERY SELECT
    (v_current < v_limit) AS allowed,
    v_current AS current_count,
    v_limit AS max_limit,
    GREATEST(0, v_limit - v_current::integer) AS remaining;
END;
$$;

-- Treat admins as owning every game mode without a purchase row, so the
-- "Hosts can view their own unlocked modes" SELECT policy still applies but
-- returns every mode for admins via this helper RPC used by the client.
CREATE OR REPLACE FUNCTION get_unlocked_game_modes(p_host_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF has_role(p_host_id, 'admin'::app_role) THEN
    RETURN ARRAY['judge', 'voting', 'forgery', 'duel'];
  END IF;

  RETURN ARRAY(
    SELECT game_mode FROM purchased_game_modes WHERE host_id = p_host_id
  );
END;
$$;
