-- Add presentation_order column to rounds if not exists
ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS presentation_order jsonb;

-- Ensure prevent_self_vote trigger exists on image_votes
DROP TRIGGER IF EXISTS prevent_self_vote_trigger ON public.image_votes;
CREATE TRIGGER prevent_self_vote_trigger
BEFORE INSERT OR UPDATE ON public.image_votes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_vote();