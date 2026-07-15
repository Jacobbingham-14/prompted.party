/**
 * Duel mode: players type a short, funny written ANSWER to a prompt (e.g.
 * "A screaming goat in a business suit"). Keep the image instruction minimal
 * so the model follows the player's words without imposing a house art style.
 *
 * The transformation is deterministic (no extra API/LLM call) so it adds zero
 * latency and needs no new secrets.
 */
export function buildDuelImagePrompt(answer: string): string {
  const cleaned = answer.trim().replace(/\s+/g, ' ').slice(0, 300);
  return `Create an image of: ${cleaned}`;
}

/** Client-side sanity check mirroring the DB/edge limits. */
export function isValidDuelAnswer(answer: string): boolean {
  const t = answer.trim();
  return t.length >= 1 && t.length <= 200;
}
