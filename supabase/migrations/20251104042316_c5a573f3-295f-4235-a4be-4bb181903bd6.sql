-- Drop the old policy that requires authentication
DROP POLICY IF EXISTS "Players can create own submissions" ON public.submissions;

-- Create new policy that allows players to submit (authenticated OR anonymous)
CREATE POLICY "Players can create own submissions" 
ON public.submissions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM players
    WHERE players.id = submissions.player_id
  )
);