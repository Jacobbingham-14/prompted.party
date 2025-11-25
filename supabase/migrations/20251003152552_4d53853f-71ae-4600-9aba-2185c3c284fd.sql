-- Add user_id to rooms table to track authenticated hosts
ALTER TABLE public.rooms
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies for rooms table
-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can view rooms" ON public.rooms;

-- New policies: Only authenticated hosts can manage their rooms
CREATE POLICY "Authenticated users can create rooms"
ON public.rooms
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view rooms"
ON public.rooms
FOR SELECT
USING (true);

CREATE POLICY "Hosts can update their own rooms"
ON public.rooms
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Add comment explaining the security model
COMMENT ON COLUMN public.rooms.user_id IS 'References the authenticated host who created the room. Required for host-only authentication.';
COMMENT ON TABLE public.rooms IS 'Game rooms with host-only authentication. Hosts must be authenticated, players join without auth.';