import { supabase } from '@/integrations/supabase/client';
import { normalizeRoomCode } from '@/lib/roomCode';

/**
 * Looks up a room through the SECURITY DEFINER RPC used by anonymous guests.
 * A single retry prevents a brief network/API hiccup from being reported as
 * a nonexistent room. Successful empty results still mean the code is wrong.
 */
export async function findRoomByCode(rawCode: string) {
  const code = normalizeRoomCode(rawCode);
  const lookup = () => supabase.rpc('find_room_by_code', { room_code: code });

  let result = await lookup();
  if (result.error) {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    result = await lookup();
  }

  if (result.error) throw result.error;

  const rows = result.data;
  return {
    code,
    room: Array.isArray(rows) ? rows[0] ?? null : rows ?? null,
  };
}
