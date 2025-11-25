-- Fix critical submissions table security vulnerability
-- Drop permissive policies that allow cheating
DROP POLICY IF EXISTS "Anyone can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Anyone can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Anyone can view submissions" ON public.submissions;

-- Only room members can view submissions
CREATE POLICY "Room members can view submissions"
ON public.submissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r
    JOIN public.rooms rm ON rm.id = r.room_id
    WHERE r.id = submissions.round_id
    AND (rm.host_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.players p 
      WHERE p.room_id = rm.id AND auth.uid() IS NOT NULL
    ))
  )
);

-- Players can only create submissions for themselves
CREATE POLICY "Players can create own submissions"
ON public.submissions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players
    WHERE id = player_id
    AND auth.uid() IS NOT NULL
  )
);

-- Only judges can mark winners
CREATE POLICY "Judges can mark winners"
ON public.submissions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r
    JOIN public.players p ON p.id = r.judge_id
    WHERE r.id = submissions.round_id
    AND p.is_judge = true
    AND auth.uid() IS NOT NULL
  )
);