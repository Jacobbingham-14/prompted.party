-- Fix security definer view by enabling security invoker mode
-- This ensures the view respects RLS policies and uses the querying user's permissions
DROP VIEW IF EXISTS user_game_stats;

CREATE VIEW user_game_stats
  WITH (security_invoker=on)
AS
SELECT 
  host_id,
  COUNT(*) as total_games_hosted,
  COUNT(*) FILTER (WHERE status = 'ended') as completed_games,
  COUNT(*) FILTER (WHERE status = 'active') as active_games,
  COUNT(*) FILTER (WHERE status = 'waiting') as waiting_games,
  MIN(created_at) as first_game_date,
  MAX(created_at) as last_game_date,
  MAX(updated_at) as last_activity_date
FROM rooms
WHERE host_id IS NOT NULL
GROUP BY host_id;

-- Grant access to authenticated users
GRANT SELECT ON user_game_stats TO authenticated;