# Prompted.Party — Launch To-Do

## Payments
- [ ] Check payments work — complete one real, paid checkout end to end ($19.99 full access, and a $5/1000-credit top-up) and confirm each unlocks correctly on the account.
- [ ] Add promo codes for the first two [users/friends] — free or discounted access codes so early testers don't have to pay. (Not built yet: Stripe Checkout supports discount/promo codes natively, so this is a small addition to `create-checkout-session` plus enabling promo codes on the Stripe Checkout session.)
- [x] Pricing model switched to one product: $19.99 unlocks all 4 game modes + 1000 image generations included. Old per-mode ($7) and bundle ($12/$20) pricing removed.
- [x] Credit top-up switched to $5 per 1000 generations (replaces the old $1/250 pack).

## Testing
- [ ] Clayton creates an account (sign up in the app) — once he has, send Jacob the account email so admin access + unlimited generations can be granted.
- [ ] Give Clayton's account unlimited image generations (same manual DB grant used for Jacob's account).
- [ ] Give Clayton's account the admin role so he can access the Prompts Manager.
- [ ] Explain the Prompts Manager URL and how to use it to Clayton (see below).
- [ ] Playtest with a real group in person before public launch.

## Content
- [ ] Write and review new prompts with Clayton (via the Prompts Manager admin page) — one tab per game mode (Judge, Voting, Forgery, Duel), plus a Community Submissions tab.
- [ ] Use the new "Copy to..." action to share good prompts across modes instead of retyping them.

## Polish
- [ ] Background music / audio pass.
- [ ] Compare image generation APIs (Replicate vs. alternatives) on cost and latency.

## Prompts Manager — how to use it (forward to Clayton)
1. Log in to the app, then go to `https://prompted.party/prompts-manager` directly (no menu link yet).
2. There's a tab per game mode: Judge, Voting, Forgery, Duel, plus a "Community Submissions" tab for prompts players submit live in-game.
3. Each mode's prompts are independent now — editing one mode doesn't affect the others.
4. "Add Prompt" adds one at a time; "Bulk Import" pastes many at once (one per line — Forgery's bulk import expects `main prompt | forger prompt` per line, since Forgery needs a real/decoy pair).
5. Select multiple prompts with the checkboxes to Archive, Restore, Delete, or "Copy to..." another mode in bulk.
6. Archiving hides a prompt from gameplay without deleting it — safer than Delete if you're not sure.
