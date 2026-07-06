# Stripe setup for Prompted.Party

Six products to create in the Stripe dashboard (Products → Add product), each as a **one-time** price (not recurring):

| Product | Price | Env var to set on `create-checkout-session` |
|---|---|---|
| Judge mode | $7.00 | `STRIPE_PRICE_MODE_JUDGE` |
| Voting mode | $7.00 | `STRIPE_PRICE_MODE_VOTING` |
| Forgery mode | $7.00 | `STRIPE_PRICE_MODE_FORGERY` |
| Duel mode | $7.00 | `STRIPE_PRICE_MODE_DUEL` |
| Any-2 bundle | $12.00 | `STRIPE_PRICE_BUNDLE_2` |
| All-4 bundle | $20.00 | `STRIPE_PRICE_BUNDLE_4` |
| Image credit pack | $1.00, quantity-adjustable | `STRIPE_PRICE_CREDIT_PACK` |

Each purchase is $7 for one mode by itself — the $12 and $20 prices are only reached when the buyer selects 2 or 4 modes at once (checkout logic in `create-checkout-session` sends the right price ID for the right selection).

The credit pack price should be a single **quantity-adjustable** price of $1.00 = 250 credits; `create-checkout-session` sets Stripe line-item quantity to however many packs the host buys (e.g. quantity 4 = 1,000 credits for $4).

## Steps
1. Create the 7 prices above in the Stripe dashboard, copy each Price ID (starts `price_...`).
2. In Supabase → Project Settings → Edge Functions → Secrets, add: the 7 price IDs above, `STRIPE_SECRET_KEY` (from Stripe → Developers → API keys), and after step 4, `STRIPE_WEBHOOK_SECRET`.
3. Deploy both functions:
   ```
   supabase functions deploy create-checkout-session
   supabase functions deploy stripe-webhook
   ```
4. In Stripe → Developers → Webhooks, add an endpoint pointing at your deployed `stripe-webhook` function URL, listening for `checkout.session.completed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Run the new migration (`20260706000000_monetization.sql`) against your Supabase project.
6. Test end-to-end in Stripe test mode (test card `4242 4242 4242 4242`) before going live.

## Still to build (frontend)
- A purchase screen: single-mode buy button ($7), a way to select 2 modes for the $12 bundle, one-click all-4 for $20, and a credits top-up button.
- Gating in room creation (`src/pages/Index.tsx`) so `handleCreateRoom` checks `purchased_game_modes` before letting a host start a locked mode.
- A "buy more credits" CTA wired into the existing 0-remaining state in `src/components/ImageGenerator.tsx`.
