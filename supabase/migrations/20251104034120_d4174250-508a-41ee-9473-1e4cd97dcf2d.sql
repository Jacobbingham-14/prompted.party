-- Allow updating votes so players can change their selection (upsert path)
DROP POLICY IF EXISTS "Players can update their prompt vote" ON public.prompt_votes;
CREATE POLICY "Players can update their prompt vote"
ON public.prompt_votes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = prompt_votes.player_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = prompt_votes.player_id
  )
);

DROP POLICY IF EXISTS "Players can update their image vote" ON public.image_votes;
CREATE POLICY "Players can update their image vote"
ON public.image_votes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = image_votes.voter_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = image_votes.voter_id
  )
);