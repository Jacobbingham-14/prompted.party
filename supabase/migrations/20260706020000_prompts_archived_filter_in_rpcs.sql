-- Make the two RPC-driven prompt pickers (Forgery, Duel) respect the new
-- `archived` flag added by the prompts_per_mode migration. Client-side
-- reads for Judge/Voting already filter on archived = false, but Forgery
-- and Duel pick their prompt(s) inside these SECURITY DEFINER functions.

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

  v_forger_ids := v_player_ids[1:v_num_forgers];

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
  SELECT host_id INTO v_host FROM public.rooms WHERE id = p_room_id;
  IF v_host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_caller IS NULL OR v_caller <> v_host THEN
    RAISE EXCEPTION 'Only the host can start a duel round';
  END IF;

  IF EXISTS (SELECT 1 FROM public.duel_matchups WHERE round_id = p_round_id) THEN
    RETURN;
  END IF;

  SELECT ARRAY_AGG(id ORDER BY random()) INTO v_players
  FROM public.players WHERE room_id = p_room_id;

  v_n := COALESCE(array_length(v_players, 1), 0);
  IF v_n < 3 THEN
    RAISE EXCEPTION 'Duel mode requires at least 3 players';
  END IF;

  -- Pull up to v_n distinct prompts, skipping archived ones (reused cyclically if the bank is small)
  SELECT ARRAY_AGG(text) INTO v_prompts
  FROM (
    SELECT text FROM public.duel_prompts WHERE archived = false ORDER BY random() LIMIT v_n
  ) sub;

  v_num_prompts := COALESCE(array_length(v_prompts, 1), 0);
  IF v_num_prompts = 0 THEN
    v_prompts := ARRAY['Describe the worst possible superpower'];
    v_num_prompts := 1;
  END IF;

  FOR v_i IN 1..v_n LOOP
    v_a := v_players[v_i];
    v_b := v_players[(v_i % v_n) + 1];
    v_prompt := v_prompts[((v_i - 1) % v_num_prompts) + 1];

    INSERT INTO public.duel_matchups (
      round_id, room_id, matchup_order, prompt_text, player_a_id, player_b_id, status
    ) VALUES (
      p_round_id, p_room_id, v_i - 1, v_prompt, v_a, v_b, 'pending'
    );
  END LOOP;

  UPDATE public.rounds
  SET status = 'duel-submitting',
      deadline_at = now() + interval '180 seconds',
      active_matchup_id = NULL
  WHERE id = p_round_id;
END;
$$;
