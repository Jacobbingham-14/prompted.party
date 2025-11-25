-- Fix prompt_votes policies to allow unauthenticated players to vote
DROP POLICY IF EXISTS "Players can create their own prompt votes" ON public.prompt_votes;

CREATE POLICY "Players can create their own prompt votes"
ON public.prompt_votes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = player_id
  )
);

-- Also fix the SELECT policy for consistency
DROP POLICY IF EXISTS "Players can view prompt votes in their room" ON public.prompt_votes;

CREATE POLICY "Players can view prompt votes in their room"
ON public.prompt_votes FOR SELECT
USING (true);

-- Fix image_votes policies the same way
DROP POLICY IF EXISTS "Players can create their own image votes" ON public.image_votes;

CREATE POLICY "Players can create their own image votes"
ON public.image_votes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = voter_id
  )
);

-- Also fix the SELECT policy for image_votes
DROP POLICY IF EXISTS "Players can view image votes in their room" ON public.image_votes;

CREATE POLICY "Players can view image votes in their room"
ON public.image_votes FOR SELECT
USING (true);