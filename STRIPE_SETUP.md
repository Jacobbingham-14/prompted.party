# Stripe setup for Prompted.Party

Two products to create in the Stripe dashboard (Products → Add product), each as a **one-time** price (not recurring):

| Product | Price | Env var to set on `create-checkout-session` |
|---|---|---|
| Full Access — All Game Modes + 1000 Image Credits | $19.99 | `STRIPE_PRICE_FULL_ACCESS` |
| 1000 Image Generation Credits (Top-Up) | $5.00, quantity-adjustable | `STRIPE_PRICE_CREDIT_PACK` |

One purchase unlocks all 4 game modes (Judge, Voting, Forgery, Duel) plus 1000 included image generations. The top-up product is for after those 1000 run out — `create-checkout-session` sets Stripe line-item quantity to however many 1000-credit packs the host buys (e.g. quantity 2 = 2,000 credits for $10).

Current live price IDs (already created and configured in Supabase secrets):
- `STRIPE_PRICE_FULL_ACCESS` = `price_1TqLs8KNI6rxkP0lwxM0I9nG`
- `STRIPE_PRICE_CREDIT_PACK` = `price_1TqLuJKNI6rxkP0lb2LoEo4v`

## Steps
1. Create the 2 prices above in the Stripe dashboard, copy each Price ID (starts `price_...`).
2. In Supabase → Project Settings → Edge Functions → Secrets, add: the 2 price IDs above, `STRIPE_SECRET_KEY` (from Stripe → Developers → API keys), and after step 4, `STRIPE_WEBHOOK_SECRET`.
3. Deploy both functions:
   ```
   supabase functions deploy create-checkout-session
   supabase functions deploy stripe-webhook
   ```
4. In Stripe → Developers → Webhooks, add an endpoint pointing at your deployed `stripe-webhook` function URL, listening for `checkout.session.completed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Run the migrations under `supabase/migrations/` against your Supabase project (includes `purchase_events.kind` allowing `'full_access'`).
6. Test end-to-end in Stripe test mode (test card `4242 4242 4242 4242`) before going live.

## Frontend
- Purchase screen: single "Unlock Everything — $19.99" button (`src/pages/Landing.tsx`) — no more per-mode or bundle pricing.
- Gating in room creation (`src/pages/Index.tsx`) checks `purchased_game_modes` before letting a host start a mode; a full-access purchase populates all 4 rows at once.
- A "Buy 1,000 more credits – $5" CTA wired into the low/zero-remaining state in `src/components/ImageGenerator.tsx`.
