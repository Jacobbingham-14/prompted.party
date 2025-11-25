-- Fix the prevent_self_vote function to have immutable search path
CREATE OR REPLACE FUNCTION prevent_self_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.submissions
    WHERE id = NEW.submission_id
    AND player_id = NEW.voter_id
  ) THEN
    RAISE EXCEPTION 'Cannot vote for your own submission';
  END IF;
  RETURN NEW;
END;
$$;