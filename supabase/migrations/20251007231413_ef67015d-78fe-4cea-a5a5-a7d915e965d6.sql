-- Create a function to find a room by code (bypasses RLS for this specific use case)
CREATE OR REPLACE FUNCTION public.find_room_by_code(room_code TEXT)
RETURNS TABLE (
  id UUID,
  code TEXT,
  status TEXT,
  host_id UUID,
  user_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, code, status, host_id, user_id, created_at, updated_at
  FROM public.rooms
  WHERE code = room_code
  LIMIT 1;
$$;