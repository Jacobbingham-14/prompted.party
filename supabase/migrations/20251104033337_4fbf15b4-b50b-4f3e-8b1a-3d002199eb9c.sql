-- Drop the existing restrictive policy that only allows hosts to view rounds
DROP POLICY IF EXISTS "Hosts can view their rounds" ON public.rounds;

-- Create a new policy that allows anyone to view rounds
-- This is necessary because players aren't authenticated users, but they need to see
-- the current round to know the game state (prompt-voting, submitting, etc.)
CREATE POLICY "Anyone can view rounds"
ON public.rounds FOR SELECT
USING (true);

-- Note: Write operations (INSERT, UPDATE, DELETE) are still restricted to hosts only
-- via the existing policies, so this doesn't compromise game security