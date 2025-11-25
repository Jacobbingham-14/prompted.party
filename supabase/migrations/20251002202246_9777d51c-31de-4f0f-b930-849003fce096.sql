-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can update players" ON public.players;

-- Create more restrictive policies

-- Players can still view all players in any room (needed for lobby/scoreboard)
-- This policy already exists and is fine

-- Players can still create their own player record when joining
-- This policy already exists and is fine

-- NEW: Only allow updates to non-sensitive fields
-- Regular players cannot modify: score, is_host, is_judge
CREATE POLICY "Players cannot update sensitive fields"
ON public.players
FOR UPDATE
USING (false); -- Block all direct updates

-- Create security definer functions for privileged operations

-- Function to update player score (called after winner is selected)
CREATE OR REPLACE FUNCTION public.increment_player_score(
  p_player_id UUID,
  p_round_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner_submission_id UUID;
BEGIN
  -- Verify this player actually won this round
  SELECT id INTO v_winner_submission_id
  FROM public.submissions
  WHERE round_id = p_round_id
    AND player_id = p_player_id
    AND is_winner = true;
  
  IF v_winner_submission_id IS NULL THEN
    RAISE EXCEPTION 'Player did not win this round';
  END IF;
  
  -- Increment the score
  UPDATE public.players
  SET score = score + 1
  WHERE id = p_player_id;
END;
$$;

-- Function to set judge for a round (only host can call)
CREATE OR REPLACE FUNCTION public.set_round_judge(
  p_room_id UUID,
  p_judge_id UUID,
  p_caller_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_host BOOLEAN;
BEGIN
  -- Verify caller is the host of this room
  SELECT is_host INTO v_is_host
  FROM public.players
  WHERE id = p_caller_id
    AND room_id = p_room_id;
  
  IF NOT COALESCE(v_is_host, false) THEN
    RAISE EXCEPTION 'Only the host can set the judge';
  END IF;
  
  -- Reset all judges in this room
  UPDATE public.players
  SET is_judge = false
  WHERE room_id = p_room_id;
  
  -- Set the new judge
  UPDATE public.players
  SET is_judge = true
  WHERE id = p_judge_id
    AND room_id = p_room_id;
END;
$$;

-- Function to create host player (only used during room creation)
CREATE OR REPLACE FUNCTION public.create_host_player(
  p_room_id UUID,
  p_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id UUID;
  v_existing_host UUID;
BEGIN
  -- Check if room already has a host
  SELECT id INTO v_existing_host
  FROM public.players
  WHERE room_id = p_room_id
    AND is_host = true;
  
  IF v_existing_host IS NOT NULL THEN
    RAISE EXCEPTION 'Room already has a host';
  END IF;
  
  -- Create the host player
  INSERT INTO public.players (room_id, name, is_host)
  VALUES (p_room_id, p_name, true)
  RETURNING id INTO v_player_id;
  
  RETURN v_player_id;
END;
$$;

-- Grant execute permissions to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.increment_player_score TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_round_judge TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_host_player TO authenticated, anon;