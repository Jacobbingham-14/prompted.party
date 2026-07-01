/**
 * Duel mode: players type a short, funny written ANSWER to a prompt (e.g.
 * "A screaming goat in a business suit"). We never send that raw text to the
 * image model — instead we wrap it into a stronger, more descriptive image
 * generation prompt so the result looks polished and reads as intentional
 * comedy, matching the playful tone of the rest of Prompted.party.
 *
 * The transformation is deterministic (no extra API/LLM call) so it adds zero
 * latency and needs no new secrets.
 */
export function buildDuelImagePrompt(answer: string): string {
  const cleaned = answer.trim().replace(/\s+/g, ' ').slice(0, 300);
  return (
    `A funny, exaggerated, high-quality digital illustration of: "${cleaned}". ` +
    `Playful party-game art style, vivid saturated colors, expressive and comedic, ` +
    `dynamic composition, clean lighting, highly detailed, centered subject.`
  );
}

/** Client-side sanity check mirroring the DB/edge limits. */
export function isValidDuelAnswer(answer: string): boolean {
  const t = answer.trim();
  return t.length >= 1 && t.length <= 200;
}
