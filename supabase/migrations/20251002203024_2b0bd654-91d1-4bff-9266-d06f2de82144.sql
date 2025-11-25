-- Remove is_host column from players table since hosts are not players
ALTER TABLE public.players DROP COLUMN IF EXISTS is_host;

-- Drop the create_host_player function since we no longer need it
DROP FUNCTION IF EXISTS public.create_host_player(uuid, text);

-- Update the set_round_judge function to remove host check
-- Now it just needs to verify the caller is the host_id stored in the room
CREATE OR REPLACE FUNCTION public.set_round_judge(p_room_id uuid, p_judge_id uuid, p_caller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id UUID;
BEGIN
  -- Verify caller is the host of this room
  SELECT host_id INTO v_host_id
  FROM public.rooms
  WHERE id = p_room_id;
  
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Room has no host';
  END IF;
  
  IF v_host_id != p_caller_id THEN
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