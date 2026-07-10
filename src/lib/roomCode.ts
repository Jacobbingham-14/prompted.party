// Excludes O and 0 -- too easy to mix up when read off a screen or shouted
// across a room.
const ROOM_CODE_CHARS = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";

export function generateRoomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}
