-- Stage 2: Database lockdown
-- Closes three real security holes without requiring player-side auth:
-- 1. Wide-open rounds UPDATE policy allowed any anonymous client to modify
--    a round while its status was 'not_started'.
-- 2. delete_ended_room_service RPC was callable by any client (should be
--    reachable only from the cleanup edge function using the service role).
-- 3. Host-check RPCs (set_round_judge, delete_ended_room) trusted a
--    client-supplied UUID as "who is calling"; now they check the actual
--    authenticated session via auth.uid().

-- ---------------------------------------------------------------------------
-- 1. rounds UPDATE: host-only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow round updates" ON rounds;

CREATE POLICY "Hosts can update their rooms' rounds" ON rounds
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = rounds.room_id
      AND rooms.host_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Lock down delete_ended_room_service to service_role only
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.delete_ended_room_service(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_ended_room_service(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_ended_room_service(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_ended_room_service(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Tighten host-check RPCs to use auth.uid() rather than the p_caller_id
--    parameter. The parameter is kept in the signature so existing frontend
--    callers still work without code changes, but its value is ignored.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_round_judge(
  p_room_id uuid,
  p_judge_id uuid,
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
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_host_id <> v_caller THEN
    RAISE EXCEPTION 'Only the host can set the round judge';
  END IF;

  -- Reset all players in the room, then mark the chosen judge.
  UPDATE players SET is_judge = false WHERE room_id = p_room_id;
  UPDATE players SET is_judge = true WHERE id = p_judge_id AND room_id = p_room_id;
END;
$$;

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
    -- Already gone; treat as a no-op so the caller isn't blocked.
    RETURN;
  END IF;

  IF v_host_id <> v_caller THEN
    RAISE EXCEPTION 'Only the host can delete this room';
  END IF;

  -- Cascade delete of gameplay data.
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
