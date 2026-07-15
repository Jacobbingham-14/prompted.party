// Excludes O and 0 -- too easy to mix up when read off a screen or shouted
// across a room.
const ROOM_CODE_CHARS = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";

/**
 * Room codes are always six ASCII letters/numbers. Removing spaces and
 * punctuation makes codes copied from styled/letter-spaced UI safe to use.
 */
export function normalizeRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function generateRoomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}
