-- Forgery mode: keep forger selection random, but never pick the same
-- player who was the forger in this room's immediately preceding round.

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
  v_previous_forger_ids uuid[];
  v_candidate_ids uuid[];
  v_main_prompt text;
  v_forger_prompt text;
  v_i integer;
BEGIN
  SELECT ARRAY_AGG(id ORDER BY random()) INTO v_player_ids
  FROM players
  WHERE room_id = p_room_id;

  v_num_players := COALESCE(array_length(v_player_ids, 1), 0);
  IF v_num_players = 0 THEN RETURN; END IF;

  IF v_num_players BETWEEN 3 AND 4 THEN
    v_num_forgers := 1;
  ELSIF v_num_players BETWEEN 5 AND 7 THEN
    v_num_forgers := 2;
  ELSE
    v_num_forgers := 3;
  END IF;

  -- Whoever forged in this room's most recent prior round is excluded from
  -- the candidate pool. Falls back to the full player pool if that would
  -- leave too few candidates to fill the needed forger slots (e.g. players
  -- having left the room between rounds).
  SELECT ARRAY_AGG(prp.player_id)
  INTO v_previous_forger_ids
  FROM player_round_prompts prp
  JOIN rounds r ON r.id = prp.round_id
  WHERE r.room_id = p_room_id
    AND r.id <> p_round_id
    AND prp.is_forger = true
    AND r.round_number = (
      SELECT MAX(round_number)
      FROM rounds
      WHERE room_id = p_room_id AND id <> p_round_id
    );

  SELECT ARRAY_AGG(pid ORDER BY random())
  INTO v_candidate_ids
  FROM UNNEST(v_player_ids) AS pid
  WHERE v_previous_forger_ids IS NULL OR pid <> ALL(v_previous_forger_ids);

  IF COALESCE(array_length(v_candidate_ids, 1), 0) < v_num_forgers THEN
    v_candidate_ids := v_player_ids;
  END IF;

  v_forger_ids := v_candidate_ids[1:v_num_forgers];

  -- Pick a random prompt pair, skipping archived ones
  SELECT main_prompt, forger_prompt
  INTO v_main_prompt, v_forger_prompt
  FROM forgery_prompts
  WHERE archived = false
  ORDER BY random()
  LIMIT 1;

  IF v_main_prompt IS NULL THEN
    v_main_prompt := 'A peaceful sunny day';
    v_forger_prompt := 'A stormy day';
  END IF;

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

  UPDATE rounds
  SET
    status = 'forgery-prompt-assigned',
    prompt = v_main_prompt,
    selected_prompts = jsonb_build_array(v_main_prompt, v_forger_prompt)
  WHERE id = p_round_id;
END;
$$;
