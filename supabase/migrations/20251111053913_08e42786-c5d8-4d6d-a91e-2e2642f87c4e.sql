-- Drop the existing view
DROP VIEW IF EXISTS user_game_stats;

-- Create user_game_stats as a table
CREATE TABLE public.user_game_stats (
  host_id UUID PRIMARY KEY,
  total_games_hosted BIGINT NOT NULL DEFAULT 0,
  completed_games BIGINT NOT NULL DEFAULT 0,
  active_games BIGINT NOT NULL DEFAULT 0,
  waiting_games BIGINT NOT NULL DEFAULT 0,
  first_game_date TIMESTAMP WITH TIME ZONE,
  last_game_date TIMESTAMP WITH TIME ZONE,
  last_activity_date TIMESTAMP WITH TIME ZONE,
  total_image_generations BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_game_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own stats"
  ON public.user_game_stats
  FOR SELECT
  USING (auth.uid() = host_id);

CREATE POLICY "Admins can view all stats"
  ON public.user_game_stats
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Populate with existing data
INSERT INTO public.user_game_stats (
  host_id,
  total_games_hosted,
  completed_games,
  active_games,
  waiting_games,
  first_game_date,
  last_game_date,
  last_activity_date,
  total_image_generations
)
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
GROUP BY r.host_id, igs.total_generations
ON CONFLICT (host_id) DO NOTHING;

-- Function to refresh stats for a specific host
CREATE OR REPLACE FUNCTION public.refresh_host_stats(p_host_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats RECORD;
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

  -- Get image generation count
  SELECT COALESCE(total_generations, 0) INTO v_stats.total_gens
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
    COALESCE(v_stats.total_gens, 0),
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

-- Trigger function for rooms table
CREATE OR REPLACE FUNCTION public.update_host_stats_on_room_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_host_stats(OLD.host_id);
    RETURN OLD;
  ELSE
    PERFORM refresh_host_stats(NEW.host_id);
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger on rooms table
CREATE TRIGGER trigger_update_host_stats
AFTER INSERT OR UPDATE OR DELETE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION update_host_stats_on_room_change();

-- Trigger function for image_generation_stats
CREATE OR REPLACE FUNCTION public.update_host_stats_on_generation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM refresh_host_stats(NEW.user_id);
  RETURN NEW;
END;
$$;

-- Trigger on image_generation_stats table
CREATE TRIGGER trigger_update_host_stats_on_generation
AFTER INSERT OR UPDATE ON public.image_generation_stats
FOR EACH ROW
EXECUTE FUNCTION update_host_stats_on_generation_change();