-- Fix security definer view by adding security_invoker
DROP VIEW IF EXISTS user_game_stats;

CREATE VIEW user_game_stats 
WITH (security_invoker=on)
AS
SELECT 
  r.host_id,
  COUNT(*) as total_games_hosted,
  COUNT(*) FILTER (WHERE r.status = 'ended') as completed_games,
  COUNT(*) FILTER (WHERE r.status = 'playing') as active_games,
  COUNT(*) FILTER (WHERE r.status = 'waiting') as waiting_games,
  MIN(r.created_at) as first_game_date,
  MAX(r.created_at) as last_game_date,
  MAX(r.updated_at) as last_activity_date,
  COALESCE(igs.total_generations, 0) as total_image_generations
FROM rooms r
LEFT JOIN image_generation_stats igs ON igs.user_id = r.host_id
GROUP BY r.host_id, igs.total_generations;