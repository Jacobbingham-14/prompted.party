-- Drop the current overly permissive policy
DROP POLICY "Anyone can view rooms" ON public.rooms;

-- Create a new policy that only allows room members (players) to view room details
CREATE POLICY "Only room members can view rooms" 
ON public.rooms 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.players 
    WHERE players.room_id = rooms.id 
    AND auth.uid() IS NOT NULL
  ) 
  OR auth.uid() = user_id -- Host can always see their own room
);