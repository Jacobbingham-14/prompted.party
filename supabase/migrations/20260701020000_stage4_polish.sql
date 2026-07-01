-- Stage 4: Polish & defense-in-depth
-- Add a self-vote guard trigger on forgery_votes (mirroring the existing
-- prevent_self_vote_trigger on image_votes). A player can't accuse
-- themselves of being the forger, even if the client is manipulated.
--
-- (A case-insensitive unique index on players(room_id, name) would be a
-- nice-to-have here too, but existing production data contains duplicates
-- from earlier games that would have to be resolved first. The client-side
-- "reuse existing player row on rejoin" logic handles the common case.)

CREATE OR REPLACE FUNCTION public.prevent_forgery_self_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.voter_id = NEW.accused_player_id THEN
    RAISE EXCEPTION 'You cannot accuse yourself of being the forger';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_forgery_self_vote_trigger ON public.forgery_votes;
CREATE TRIGGER prevent_forgery_self_vote_trigger
  BEFORE INSERT OR UPDATE ON public.forgery_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_forgery_self_vote();
