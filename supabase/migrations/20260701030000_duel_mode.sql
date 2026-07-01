-- ============================================================
-- Duel Mode (Quiplash-style head-to-head)
--
-- Each round, players are paired into head-to-head matchups on a shared
-- prompt. Each player is in exactly TWO matchups (gets two prompts), each
-- prompt/matchup has exactly two competitors, and nobody faces themselves.
-- Everyone who is NOT a competitor votes on a matchup; the host reveals one
-- matchup at a time. Points scale by round: round_number * 100 per vote.
--
-- Implemented with dedicated tables so the existing judge/voting/forgery
-- pipelines are completely untouched.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Allow 'duel' (and 'forgery', which slipped past the old CHECK) in game_mode
-- ------------------------------------------------------------
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_game_mode_check;
ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_game_mode_check
  CHECK (game_mode IN ('judge', 'voting', 'forgery', 'duel'));

-- Which matchup is currently on the host screen (drives the one-at-a-time reveal).
ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS active_matchup_id uuid;

-- ------------------------------------------------------------
-- 1. duel_prompts: Quiplash-style fill-in prompt bank
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duel_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.duel_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read duel prompts"
  ON public.duel_prompts FOR SELECT USING (true);

-- ------------------------------------------------------------
-- 2. duel_matchups: one head-to-head pairing on one prompt
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duel_matchups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  matchup_order integer NOT NULL,
  prompt_text text NOT NULL,
  player_a_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player_b_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending | voting | revealed
  winner_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (round_id, matchup_order)
);
ALTER TABLE public.duel_matchups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read duel matchups"
  ON public.duel_matchups FOR SELECT USING (true);
-- Matchups are only mutated via SECURITY DEFINER RPCs (create/finalize) and by
-- the authenticated host advancing the reveal.
CREATE POLICY "Hosts can update their duel matchups"
  ON public.duel_matchups FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = duel_matchups.room_id AND r.host_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 3. duel_submissions: a player's written answer + generated image for a matchup
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duel_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matchup_id uuid NOT NULL REFERENCES public.duel_matchups(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  image_url text,
  image_status text NOT NULL DEFAULT 'pending', -- pending | generating | ready | failed
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (matchup_id, player_id)
);
ALTER TABLE public.duel_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read duel submissions"
  ON public.duel_submissions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert duel submissions"
  ON public.duel_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update duel submissions"
  ON public.duel_submissions FOR UPDATE USING (true);

-- ------------------------------------------------------------
-- 4. duel_votes: a non-competitor's vote on a matchup
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duel_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matchup_id uuid NOT NULL REFERENCES public.duel_matchups(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  voted_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (matchup_id, voter_id)
);
ALTER TABLE public.duel_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read duel votes"
  ON public.duel_votes FOR SELECT USING (true);
CREATE POLICY "Players can insert duel votes"
  ON public.duel_votes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = voter_id)
  );
CREATE POLICY "Players can update their duel votes"
  ON public.duel_votes FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = voter_id)
  );

-- Guard: a competitor cannot vote on their own matchup, and the vote must be
-- for one of the two competitors.
CREATE OR REPLACE FUNCTION public.prevent_invalid_duel_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
BEGIN
  SELECT player_a_id, player_b_id INTO v_a, v_b
  FROM public.duel_matchups WHERE id = NEW.matchup_id;

  IF NEW.voter_id = v_a OR NEW.voter_id = v_b THEN
    RAISE EXCEPTION 'Competitors cannot vote on their own matchup';
  END IF;

  IF NEW.voted_player_id <> v_a AND NEW.voted_player_id <> v_b THEN
    RAISE EXCEPTION 'Vote must be for one of the two competitors';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_invalid_duel_vote_trigger ON public.duel_votes;
CREATE TRIGGER prevent_invalid_duel_vote_trigger
  BEFORE INSERT OR UPDATE ON public.duel_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invalid_duel_vote();

-- ------------------------------------------------------------
-- 5. RPC: create_duel_matchups
-- Builds a 2-regular "cycle" pairing so each player is in exactly two
-- matchups, each matchup gets a distinct prompt, and moves the round into
-- the submission phase. Host-only.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_duel_matchups(
  p_round_id uuid,
  p_room_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid;
  v_caller uuid := auth.uid();
  v_players uuid[];
  v_n integer;
  v_prompts text[];
  v_num_prompts integer;
  v_i integer;
  v_a uuid;
  v_b uuid;
  v_prompt text;
BEGIN
  -- Host guard
  SELECT host_id INTO v_host FROM public.rooms WHERE id = p_room_id;
  IF v_host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_caller IS NULL OR v_caller <> v_host THEN
    RAISE EXCEPTION 'Only the host can start a duel round';
  END IF;

  -- Idempotency: don't rebuild matchups for a round that already has them.
  IF EXISTS (SELECT 1 FROM public.duel_matchups WHERE round_id = p_round_id) THEN
    RETURN;
  END IF;

  -- Players in random order
  SELECT ARRAY_AGG(id ORDER BY random()) INTO v_players
  FROM public.players WHERE room_id = p_room_id;

  v_n := COALESCE(array_length(v_players, 1), 0);
  IF v_n < 3 THEN
    RAISE EXCEPTION 'Duel mode requires at least 3 players';
  END IF;

  -- Pull up to v_n distinct prompts (reused cyclically if the bank is small)
  SELECT ARRAY_AGG(text) INTO v_prompts
  FROM (
    SELECT text FROM public.duel_prompts ORDER BY random() LIMIT v_n
  ) sub;

  v_num_prompts := COALESCE(array_length(v_prompts, 1), 0);
  IF v_num_prompts = 0 THEN
    v_prompts := ARRAY['Describe the worst possible superpower'];
    v_num_prompts := 1;
  END IF;

  -- Cycle graph: matchup i pairs player[i] with player[i+1] (wrapping around).
  -- With n players this yields n matchups and each player appears in exactly 2.
  FOR v_i IN 1..v_n LOOP
    v_a := v_players[v_i];
    v_b := v_players[(v_i % v_n) + 1]; -- next player, wrapping to the first
    v_prompt := v_prompts[((v_i - 1) % v_num_prompts) + 1];

    INSERT INTO public.duel_matchups (
      round_id, room_id, matchup_order, prompt_text, player_a_id, player_b_id, status
    ) VALUES (
      p_round_id, p_room_id, v_i - 1, v_prompt, v_a, v_b, 'pending'
    );
  END LOOP;

  -- Move the round into the submission phase with a generous shared deadline
  -- (two answers + two image generations per player).
  UPDATE public.rounds
  SET status = 'duel-submitting',
      deadline_at = now() + interval '180 seconds',
      active_matchup_id = NULL
  WHERE id = p_round_id;
END;
$$;

-- ------------------------------------------------------------
-- 6. RPC: finalize_duel_matchup
-- Tallies votes for the active matchup, awards round_number*100 points per
-- vote to each competitor, records the winner (NULL on tie), and marks the
-- matchup revealed. Idempotent + host-only.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_duel_matchup(
  p_matchup_id uuid
)
RETURNS TABLE (
  player_a_id uuid,
  player_b_id uuid,
  a_votes integer,
  b_votes integer,
  points_per_vote integer,
  winner_player_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid;
  v_caller uuid := auth.uid();
  v_room uuid;
  v_round uuid;
  v_a uuid;
  v_b uuid;
  v_status text;
  v_round_number integer;
  v_ppv integer;
  v_a_votes integer;
  v_b_votes integer;
  v_winner uuid;
BEGIN
  SELECT m.room_id, m.round_id, m.player_a_id, m.player_b_id, m.status
    INTO v_room, v_round, v_a, v_b, v_status
  FROM public.duel_matchups m WHERE m.id = p_matchup_id;

  IF v_room IS NULL THEN RAISE EXCEPTION 'Matchup not found'; END IF;

  -- Host guard
  SELECT host_id INTO v_host FROM public.rooms WHERE id = v_room;
  IF v_caller IS NULL OR v_caller <> v_host THEN
    RAISE EXCEPTION 'Only the host can reveal a matchup';
  END IF;

  SELECT round_number INTO v_round_number FROM public.rounds WHERE id = v_round;
  v_ppv := COALESCE(v_round_number, 1) * 100;

  SELECT
    COUNT(*) FILTER (WHERE voted_player_id = v_a),
    COUNT(*) FILTER (WHERE voted_player_id = v_b)
    INTO v_a_votes, v_b_votes
  FROM public.duel_votes WHERE matchup_id = p_matchup_id;

  IF v_a_votes > v_b_votes THEN v_winner := v_a;
  ELSIF v_b_votes > v_a_votes THEN v_winner := v_b;
  ELSE v_winner := NULL; -- tie
  END IF;

  -- Award points only once (idempotent on re-reveal / double-click).
  IF v_status <> 'revealed' THEN
    UPDATE public.players SET score = score + (v_a_votes * v_ppv) WHERE id = v_a;
    UPDATE public.players SET score = score + (v_b_votes * v_ppv) WHERE id = v_b;

    UPDATE public.duel_matchups
    SET status = 'revealed', winner_player_id = v_winner
    WHERE id = p_matchup_id;
  END IF;

  RETURN QUERY SELECT v_a, v_b, v_a_votes, v_b_votes, v_ppv, v_winner;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_duel_matchups TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.finalize_duel_matchup TO authenticated, anon;

-- ------------------------------------------------------------
-- 7. Realtime
-- ------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_matchups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_votes;

-- ------------------------------------------------------------
-- 8. Extend delete_ended_room cascade to duel tables
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_ended_room(
  p_room_id uuid,
  p_caller_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT host_id INTO v_host_id FROM rooms WHERE id = p_room_id;

  IF v_host_id IS NULL THEN
    RETURN;
  END IF;

  IF v_host_id <> v_caller THEN
    RAISE EXCEPTION 'Only the host can delete this room';
  END IF;

  -- Cascade delete of gameplay data.
  DELETE FROM duel_votes WHERE round_id IN (SELECT id FROM rounds WHERE room_id = p_room_id);
  DELETE FROM duel_submissions WHERE round_id IN (SELECT id FROM rounds WHERE room_id = p_room_id);
  DELETE FROM duel_matchups WHERE round_id IN (SELECT id FROM rounds WHERE room_id = p_room_id);
  DELETE FROM image_votes  WHERE round_id IN (SELECT id FROM rounds WHERE room_id = p_room_id);
  DELETE FROM prompt_votes WHERE round_id IN (SELECT id FROM rounds WHERE room_id = p_room_id);
  DELETE FROM forgery_votes WHERE round_id IN (SELECT id FROM rounds WHERE room_id = p_room_id);
  DELETE FROM player_round_prompts WHERE round_id IN (SELECT id FROM rounds WHERE room_id = p_room_id);
  DELETE FROM submissions WHERE round_id IN (SELECT id FROM rounds WHERE room_id = p_room_id);
  DELETE FROM rounds WHERE room_id = p_room_id;
  DELETE FROM players WHERE room_id = p_room_id;
  DELETE FROM rooms WHERE id = p_room_id;
END;
$$;

-- ------------------------------------------------------------
-- 9. Seed duel prompts (Quiplash-style, keep it playful + PG-13)
-- ------------------------------------------------------------
INSERT INTO public.duel_prompts (text) VALUES
  ('The worst possible name for a cruise ship'),
  ('A terrible superhero whose power is completely useless'),
  ('The real reason the dinosaurs went extinct'),
  ('A rejected flavor of ice cream'),
  ('The worst thing to say during a job interview'),
  ('A ridiculous new Olympic sport'),
  ('The most dramatic way to quit your job'),
  ('A terrible name for a boy band'),
  ('The worst possible theme for a wedding'),
  ('A very bad idea for a new fast-food menu item'),
  ('The strangest thing to find in your grandma''s attic'),
  ('A terrible slogan for a toothpaste brand'),
  ('The worst possible pet to bring to work'),
  ('An awful thing to hear from your pilot mid-flight'),
  ('The most useless invention of all time'),
  ('A terrible name for a perfume'),
  ('The worst possible way to start a wedding toast'),
  ('A truly cursed pizza topping'),
  ('The worst thing a fortune cookie could say'),
  ('An unbelievably bad theme park ride'),
  ('The worst possible mascot for a hospital'),
  ('A terrible motivational poster caption'),
  ('The strangest excuse for being late'),
  ('A terrible name for a rock band made of grandparents')
ON CONFLICT DO NOTHING;
