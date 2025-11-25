-- Drop the restrictive policy that requires authentication
DROP POLICY IF EXISTS "Room members can view submissions" ON public.submissions;

-- Create a more permissive policy for this party game use case
-- Anyone can view submissions in active rounds (since judges are unauthenticated)
CREATE POLICY "Anyone can view submissions in active rounds"
ON public.submissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = submissions.round_id
  )
);