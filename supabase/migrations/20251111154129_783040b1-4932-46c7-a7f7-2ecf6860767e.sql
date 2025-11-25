-- Create service-role specific deletion function for automated cleanup
-- This function bypasses host verification but only works on rooms with status = 'ended'
CREATE OR REPLACE FUNCTION public.delete_ended_room_service(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_room_status TEXT;
BEGIN
  -- Verify room exists and is actually ended
  SELECT status INTO v_room_status 
  FROM public.rooms 
  WHERE id = p_room_id;
  
  IF v_room_status IS NULL THEN
    RAISE EXCEPTION 'Room not found';
  END IF;
  
  IF v_room_status != 'ended' THEN
    RAISE EXCEPTION 'Can only delete rooms with status "ended"';
  END IF;
  
  -- Delete image votes
  DELETE FROM public.image_votes
  WHERE round_id IN (
    SELECT id FROM public.rounds WHERE room_id = p_room_id
  );
  
  -- Delete prompt votes
  DELETE FROM public.prompt_votes
  WHERE round_id IN (
    SELECT id FROM public.rounds WHERE room_id = p_room_id
  );
  
  -- Delete submissions
  DELETE FROM public.submissions 
  WHERE round_id IN (
    SELECT id FROM public.rounds WHERE room_id = p_room_id
  );
  
  -- Delete rounds
  DELETE FROM public.rounds 
  WHERE room_id = p_room_id;
  
  -- Delete players
  DELETE FROM public.players 
  WHERE room_id = p_room_id;
  
  -- Delete the room itself
  DELETE FROM public.rooms 
  WHERE id = p_room_id;
  
  -- Note: user_game_stats will be updated automatically via triggers
END;
$$;