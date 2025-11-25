-- Create function to cascade delete all room-related data
CREATE OR REPLACE FUNCTION public.delete_ended_room(p_room_id UUID, p_caller_id UUID)
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
    RAISE EXCEPTION 'Room not found';
  END IF;
  
  IF v_host_id != p_caller_id THEN
    RAISE EXCEPTION 'Only the host can delete this room';
  END IF;
  
  -- Delete submissions (cascades from rounds)
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
END;
$$;

-- Update RLS policies to allow deletion

-- Allow hosts to delete their own rooms
DROP POLICY IF EXISTS "Hosts can delete their rooms" ON public.rooms;
CREATE POLICY "Hosts can delete their rooms"
ON public.rooms FOR DELETE
USING (auth.uid() = user_id);

-- Allow deletion of rounds via secure function
DROP POLICY IF EXISTS "Hosts can delete rounds" ON public.rounds;
CREATE POLICY "Hosts can delete rounds"
ON public.rounds FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = rounds.room_id
    AND rooms.host_id = auth.uid()
  )
);

-- Remove the "Players cannot be deleted" policy and add proper deletion policy
DROP POLICY IF EXISTS "Players cannot be deleted" ON public.players;

-- Allow deletion of submissions via secure function
DROP POLICY IF EXISTS "Hosts can delete submissions" ON public.submissions;
CREATE POLICY "Hosts can delete submissions"
ON public.submissions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r
    JOIN public.rooms rm ON rm.id = r.room_id
    WHERE r.id = submissions.round_id
    AND rm.host_id = auth.uid()
  )
);