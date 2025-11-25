-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Hosts and judges can update rounds" ON rounds;

-- Create a new policy that allows updates in two cases:
-- 1. The user is the host (for general game management)
-- 2. The round status is 'not_started' (for prompt selection by judge)
CREATE POLICY "Allow round updates" ON rounds
  FOR UPDATE
  USING (
    -- Host can always update their rooms' rounds
    EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = rounds.room_id 
      AND rooms.host_id = auth.uid()
    )
    OR 
    -- Allow updates during prompt selection phase
    -- Only the judge has UI to do this during not_started status
    status = 'not_started'
  );