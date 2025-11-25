CREATE OR REPLACE FUNCTION public.refresh_host_stats(p_host_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stats RECORD;
  v_total_gens BIGINT;
BEGIN
  -- Calculate current stats
  SELECT 
    COUNT(*) as total_games,
    COUNT(*) FILTER (WHERE status = 'ended') as completed,
    COUNT(*) FILTER (WHERE status = 'playing') as active,
    COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
    MIN(created_at) as first_date,
    MAX(created_at) as last_date,
    MAX(updated_at) as last_activity
  INTO v_stats
  FROM rooms
  WHERE host_id = p_host_id;

  -- Get image generation count (separate query, separate variable)
  SELECT COALESCE(total_generations, 0) INTO v_total_gens
  FROM image_generation_stats
  WHERE user_id = p_host_id;

  -- Upsert into user_game_stats
  INSERT INTO user_game_stats (
    host_id,
    total_games_hosted,
    completed_games,
    active_games,
    waiting_games,
    first_game_date,
    last_game_date,
    last_activity_date,
    total_image_generations,
    updated_at
  ) VALUES (
    p_host_id,
    COALESCE(v_stats.total_games, 0),
    COALESCE(v_stats.completed, 0),
    COALESCE(v_stats.active, 0),
    COALESCE(v_stats.waiting, 0),
    v_stats.first_date,
    v_stats.last_date,
    v_stats.last_activity,
    COALESCE(v_total_gens, 0),
    now()
  )
  ON CONFLICT (host_id) DO UPDATE SET
    total_games_hosted = EXCLUDED.total_games_hosted,
    completed_games = EXCLUDED.completed_games,
    active_games = EXCLUDED.active_games,
    waiting_games = EXCLUDED.waiting_games,
    first_game_date = EXCLUDED.first_game_date,
    last_game_date = EXCLUDED.last_game_date,
    last_activity_date = EXCLUDED.last_activity_date,
    total_image_generations = EXCLUDED.total_image_generations,
    updated_at = now();
END;
$$;