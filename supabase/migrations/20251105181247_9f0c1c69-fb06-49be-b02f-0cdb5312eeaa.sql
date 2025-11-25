-- Drop existing policy that only allows hosts
DROP POLICY IF EXISTS "Hosts can update rounds" ON rounds;

-- Create new policy that allows both hosts (for game management) and judges (for prompt selection)
CREATE POLICY "Hosts and judges can update rounds" ON rounds
  FOR UPDATE
  USING (
    -- Host can always update (for game management)
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = rounds.room_id 
      AND rooms.host_id = auth.uid()
    )
    OR
    -- Judge can update when they are the assigned judge for this round
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = rounds.judge_id
      AND players.is_judge = true
      AND auth.uid() IS NOT NULL
    )
  );