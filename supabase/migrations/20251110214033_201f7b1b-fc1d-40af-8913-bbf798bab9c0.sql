-- Create the stats table for tracking image generations per host
CREATE TABLE image_generation_stats (
  user_id uuid PRIMARY KEY,
  total_generations bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE image_generation_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own stats
CREATE POLICY "Users can view own generation stats"
  ON image_generation_stats FOR SELECT
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_generation_stats_user_id ON image_generation_stats(user_id);

-- Create function to increment generation count
CREATE OR REPLACE FUNCTION increment_generation_count(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO image_generation_stats (user_id, total_generations, updated_at)
  VALUES (p_user_id, 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_generations = image_generation_stats.total_generations + 1,
    updated_at = now();
END;
$$;

-- Update user_game_stats view to include generation count
DROP VIEW IF EXISTS user_game_stats;

CREATE VIEW user_game_stats AS
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