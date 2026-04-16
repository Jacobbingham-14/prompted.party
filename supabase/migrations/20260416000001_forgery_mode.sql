-- ============================================================
-- Forgery Mode Tables
-- ============================================================

-- forgery_prompts: paired prompts for forgery rounds
CREATE TABLE IF NOT EXISTS forgery_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  main_prompt text NOT NULL,
  forger_prompt text NOT NULL,
  set_id uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE forgery_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read forgery prompts"
  ON forgery_prompts FOR SELECT USING (true);
-- Forgery prompts are read-only via RPC; no public insert/update needed

-- player_round_prompts: each player's secret prompt for a forgery round
CREATE TABLE IF NOT EXISTS player_round_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  prompt_text text NOT NULL,
  is_forger boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (round_id, player_id)
);
ALTER TABLE player_round_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read player round prompts"
  ON player_round_prompts FOR SELECT USING (true);
CREATE POLICY "Service can insert player round prompts"
  ON player_round_prompts FOR INSERT WITH CHECK (true);

-- forgery_votes: who each player accused as the forger
CREATE TABLE IF NOT EXISTS forgery_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  accused_player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (round_id, voter_id)
);
ALTER TABLE forgery_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read forgery votes"
  ON forgery_votes FOR SELECT USING (true);
CREATE POLICY "Players can insert forgery votes"
  ON forgery_votes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = voter_id)
  );
CREATE POLICY "Players can update their own forgery votes"
  ON forgery_votes FOR UPDATE USING (
    EXISTS (SELECT 1 FROM players WHERE id = voter_id)
  );

-- ============================================================
-- RPC: assign_forgery_roles
-- Assigns each player a prompt (main or forger) and sets round status
-- ============================================================
CREATE OR REPLACE FUNCTION assign_forgery_roles(
  p_round_id uuid,
  p_room_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_ids uuid[];
  v_num_players integer;
  v_num_forgers integer;
  v_forger_ids uuid[];
  v_main_prompt text;
  v_forger_prompt text;
  v_i integer;
BEGIN
  -- Get all players in random order
  SELECT ARRAY_AGG(id ORDER BY random()) INTO v_player_ids
  FROM players
  WHERE room_id = p_room_id;

  v_num_players := COALESCE(array_length(v_player_ids, 1), 0);
  IF v_num_players = 0 THEN RETURN; END IF;

  -- Determine forger count by player count
  IF v_num_players BETWEEN 3 AND 4 THEN
    v_num_forgers := 1;
  ELSIF v_num_players BETWEEN 5 AND 7 THEN
    v_num_forgers := 2;
  ELSE
    v_num_forgers := 3;
  END IF;

  -- First N players (already randomized) are forgers
  v_forger_ids := v_player_ids[1:v_num_forgers];

  -- Pick a random prompt pair
  SELECT main_prompt, forger_prompt
  INTO v_main_prompt, v_forger_prompt
  FROM forgery_prompts
  ORDER BY random()
  LIMIT 1;

  -- Fall back if no forgery prompts exist yet
  IF v_main_prompt IS NULL THEN
    v_main_prompt := 'A peaceful sunny day';
    v_forger_prompt := 'A stormy day';
  END IF;

  -- Insert each player's prompt
  FOR v_i IN 1..v_num_players LOOP
    INSERT INTO player_round_prompts (round_id, player_id, prompt_text, is_forger)
    VALUES (
      p_round_id,
      v_player_ids[v_i],
      CASE
        WHEN v_player_ids[v_i] = ANY(v_forger_ids) THEN v_forger_prompt
        ELSE v_main_prompt
      END,
      v_player_ids[v_i] = ANY(v_forger_ids)
    )
    ON CONFLICT (round_id, player_id) DO NOTHING;
  END LOOP;

  -- Update round with prompts and move to forgery-prompt-assigned
  UPDATE rounds
  SET
    status = 'forgery-prompt-assigned',
    prompt = v_main_prompt,
    selected_prompts = jsonb_build_array(v_main_prompt, v_forger_prompt)
  WHERE id = p_round_id;
END;
$$;

-- ============================================================
-- Seed: 10 forgery prompt pairs
-- ============================================================
INSERT INTO forgery_prompts (main_prompt, forger_prompt) VALUES
  ('A peaceful beach at sunset', 'A beach during a violent storm'),
  ('A cozy living room with a fireplace', 'An abandoned, run-down living room'),
  ('A festive birthday party', 'A somber funeral gathering'),
  ('A dog excitedly playing fetch in a park', 'A cat completely ignoring its owner'),
  ('A chef proudly presenting a gourmet meal', 'A chef in a kitchen disaster with burnt food'),
  ('A glittering city skyline at night', 'A city skyline during a blackout'),
  ('A lush, vibrant forest in summer', 'A forest devastated by fire'),
  ('A busy, joyful playground full of kids', 'An eerie, abandoned playground'),
  ('A grand library filled with books and readers', 'A library that has been ransacked and destroyed'),
  ('A warm family holiday dinner', 'Someone eating alone in silence on a holiday')
ON CONFLICT DO NOTHING;
