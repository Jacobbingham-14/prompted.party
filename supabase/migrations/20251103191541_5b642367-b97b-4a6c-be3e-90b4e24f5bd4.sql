-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can create rounds" ON public.rounds;
DROP POLICY IF EXISTS "Anyone can update rounds" ON public.rounds;
DROP POLICY IF EXISTS "Anyone can view rounds" ON public.rounds;

-- Only authenticated hosts can create rounds for their rooms
CREATE POLICY "Hosts can create rounds"
ON public.rounds
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = room_id
    AND rooms.host_id = auth.uid()
  )
);

-- Only hosts can update rounds in their rooms
CREATE POLICY "Hosts can update rounds"
ON public.rounds
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = room_id
    AND rooms.host_id = auth.uid()
  )
);

-- Only authenticated hosts can view their own rounds
CREATE POLICY "Hosts can view their rounds"
ON public.rounds
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = room_id
    AND rooms.host_id = auth.uid()
  )
);