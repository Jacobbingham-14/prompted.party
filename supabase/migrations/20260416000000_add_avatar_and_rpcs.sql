-- Add avatar_url column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url text;

-- RPC: update_player_avatar
-- SECURITY DEFINER allows unauthenticated players to update their own avatar
-- but restricts the update to avatar_url ONLY (prevents score/is_judge manipulation via direct table updates)
CREATE OR REPLACE FUNCTION update_player_avatar(
  p_player_id uuid,
  p_avatar_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE players
  SET avatar_url = p_avatar_url
  WHERE id = p_player_id;
END;
$$;

-- RPC: check_generation_limit
-- Returns generation limit status for a host user
-- Used by client before generating and by edge function for enforcement
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

  SELECT COALESCE(generation_limit, 100)
  INTO v_limit
  FROM user_game_stats
  WHERE host_id = p_user_id;

  -- Default to 100 if no stats row exists yet
  IF v_limit IS NULL THEN v_limit := 100; END IF;
  IF v_current IS NULL THEN v_current := 0; END IF;

  RETURN QUERY SELECT
    (v_current < v_limit) AS allowed,
    v_current AS current_count,
    v_limit AS max_limit,
    GREATEST(0, v_limit - v_current::integer) AS remaining;
END;
$$;
