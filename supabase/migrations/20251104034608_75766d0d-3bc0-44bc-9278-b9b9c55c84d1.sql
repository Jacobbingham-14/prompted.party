-- Fix the rooms INSERT policy to properly allow authenticated users to create rooms
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;

CREATE POLICY "Authenticated users can create rooms"
ON public.rooms FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND auth.uid() = host_id);