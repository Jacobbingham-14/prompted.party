-- Allow hosts to delete players from their rooms
CREATE POLICY "Hosts can delete players from their rooms"
ON public.players
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = players.room_id
    AND rooms.host_id = auth.uid()
  )
);