-- Add explicit DELETE policy to players table to prevent player deletion
-- This makes the security posture explicit rather than relying on implicit blocking

CREATE POLICY "Players cannot be deleted"
ON public.players
FOR DELETE
USING (false);

-- Add a comment explaining the limitation
COMMENT ON TABLE public.players IS 'Players table for game sessions. Note: Without authentication, INSERT validation is limited. Proper security requires implementing auth.uid() based policies.';