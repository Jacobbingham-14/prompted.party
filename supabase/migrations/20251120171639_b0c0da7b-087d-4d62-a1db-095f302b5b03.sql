-- Allow hosts to mark winning submissions in their rooms
CREATE POLICY "Hosts can mark winners in voting mode"
ON public.submissions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM rounds r
    JOIN rooms rm ON rm.id = r.room_id
    WHERE r.id = submissions.round_id
      AND rm.host_id = auth.uid()
  )
);