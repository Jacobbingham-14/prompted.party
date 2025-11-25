-- Drop the old policy that requires authentication for players
DROP POLICY IF EXISTS "Room members can view submissions" ON public.submissions;

-- Create new policy that allows room members to view submissions (authenticated OR anonymous)
CREATE POLICY "Room members can view submissions"
ON public.submissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r
    JOIN public.rooms rm ON rm.id = r.room_id
    WHERE r.id = submissions.round_id
    AND (
      rm.host_id = auth.uid()  -- Authenticated host can view
      OR EXISTS (               -- OR any player in the room can view
        SELECT 1 FROM public.players p 
        WHERE p.room_id = rm.id
      )
    )
  )
);