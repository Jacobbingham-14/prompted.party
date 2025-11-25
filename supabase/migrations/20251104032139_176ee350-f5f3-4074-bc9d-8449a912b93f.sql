-- Add game_mode column to rooms
ALTER TABLE public.rooms 
ADD COLUMN game_mode TEXT NOT NULL DEFAULT 'judge'
CHECK (game_mode IN ('judge', 'voting'));

-- Make judge_id nullable for voting mode
ALTER TABLE public.rounds 
ALTER COLUMN judge_id DROP NOT NULL;

-- Add selected_prompts to store the 4 prompts shown to all players
ALTER TABLE public.rounds
ADD COLUMN selected_prompts JSONB;

-- Add winning_submission_ids for multiple winners
ALTER TABLE public.rounds
ADD COLUMN winning_submission_ids UUID[];

-- Create prompt_votes table
CREATE TABLE public.prompt_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(round_id, player_id)
);

-- RLS Policies for prompt_votes
ALTER TABLE public.prompt_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view prompt votes in their room"
ON public.prompt_votes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r
    JOIN public.rooms rm ON rm.id = r.room_id
    JOIN public.players p ON p.room_id = rm.id
    WHERE r.id = prompt_votes.round_id
    AND (p.id = prompt_votes.player_id OR rm.host_id = auth.uid())
  )
);

CREATE POLICY "Players can create their own prompt votes"
ON public.prompt_votes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = player_id
    AND auth.uid() IS NOT NULL
  )
);

-- Enable realtime for prompt_votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.prompt_votes;

-- Create image_votes table
CREATE TABLE public.image_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(round_id, voter_id)
);

-- Add trigger to prevent self-voting
CREATE OR REPLACE FUNCTION prevent_self_vote()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_self_vote
BEFORE INSERT ON public.image_votes
FOR EACH ROW
EXECUTE FUNCTION prevent_self_vote();

-- RLS Policies for image_votes
ALTER TABLE public.image_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view image votes in their room"
ON public.image_votes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r
    JOIN public.rooms rm ON rm.id = r.room_id
    JOIN public.players p ON p.room_id = rm.id
    WHERE r.id = image_votes.round_id
    AND (p.id = image_votes.voter_id OR rm.host_id = auth.uid())
  )
);

CREATE POLICY "Players can create their own image votes"
ON public.image_votes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = voter_id
    AND auth.uid() IS NOT NULL
  )
);

-- Enable realtime for image_votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.image_votes;

-- Update delete_ended_room function to include new tables
CREATE OR REPLACE FUNCTION public.delete_ended_room(p_room_id UUID, p_caller_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id UUID;
BEGIN
  -- Verify caller is the host of this room
  SELECT host_id INTO v_host_id 
  FROM public.rooms 
  WHERE id = p_room_id;
  
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Room not found';
  END IF;
  
  IF v_host_id != p_caller_id THEN
    RAISE EXCEPTION 'Only the host can delete this room';
  END IF;
  
  -- Delete image votes
  DELETE FROM public.image_votes
  WHERE round_id IN (
    SELECT id FROM public.rounds WHERE room_id = p_room_id
  );
  
  -- Delete prompt votes
  DELETE FROM public.prompt_votes
  WHERE round_id IN (
    SELECT id FROM public.rounds WHERE room_id = p_room_id
  );
  
  -- Delete submissions
  DELETE FROM public.submissions 
  WHERE round_id IN (
    SELECT id FROM public.rounds WHERE room_id = p_room_id
  );
  
  -- Delete rounds
  DELETE FROM public.rounds 
  WHERE room_id = p_room_id;
  
  -- Delete players
  DELETE FROM public.players 
  WHERE room_id = p_room_id;
  
  -- Delete the room itself
  DELETE FROM public.rooms 
  WHERE id = p_room_id;
END;
$$;