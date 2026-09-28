// supabase/functions/create-checkout-session/index.ts
//
// Creates a Stripe Checkout Session for one of:
//   - full_access: one-time $19.99 unlock for all 4 game modes + 1000 included
//     image-generation credits
//   - credits: an additional image-generation credit pack (1000 credits / $5,
//     any multiple), for after the included 1000 run out
//
// Full access doesn't require being signed in (guest checkout); credits do.
//
// Price IDs come from Stripe (created in the dashboard — see STRIPE_SETUP.md)
// and are read from env vars so no dollar amounts are hardcoded here.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const GAME_MODES = ['judge', 'voting', 'forgery', 'duel'] as const
type GameMode = typeof GAME_MODES[number]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY is not configured')

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })

    // Identify the buyer from their Supabase auth session, if they have one.
    // Full access can be bought as a guest: Stripe collects the email and the
    // stripe-webhook function creates the account from it. When logged out,
    // supabase-js sends the anon key here, which getUser() rejects -> guest.
    let user: { id: string; email?: string } | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      // Extract the bearer token and validate it explicitly. Calling
      // supabase.auth.getUser() with no argument tries to read a session from
      // local storage, which doesn't exist in the Deno edge runtime -- passing
      // the header alone via `global.headers` is not enough on its own.
      const jwt = authHeader.replace(/^Bearer\s+/i, '')

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data } = await supabase.auth.getUser(jwt)
      user = data.user ?? null
    }

    const body = await req.json()
    // body.type: 'full_access' | 'credits'
    // body.creditPacks: number (required for 'credits' — number of 1000-credit packs)

    let priceId: string
    let mode: 'payment' = 'payment'
    let metadata: Record<string, string> = user ? { host_id: user.id } : {}

    switch (body.type) {
      case 'full_access': {
        priceId = Deno.env.get('STRIPE_PRICE_FULL_ACCESS') ?? ''
        metadata = { ...metadata, kind: 'full_access', modes: GAME_MODES.join(','), credits: '1000' }
        break
      }
      case 'credits': {
        // Credits top up an existing account, so they need one.
        if (!user) {
          return new Response(JSON.stringify({ error: 'Sign in to buy more credits' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
        }
        const packs = Number(body.creditPacks)
        if (!Number.isInteger(packs) || packs < 1 || packs > 20) {
          // cap at 20 packs (=20,000 credits/$100) per checkout to limit abuse/fat-finger errors
          return new Response(JSON.stringify({ error: 'creditPacks must be an integer between 1 and 20' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
        }
        priceId = Deno.env.get('STRIPE_PRICE_CREDIT_PACK') ?? '' // price = $5 per 1000 credits, quantity = packs
        metadata = { ...metadata, kind: 'credits', credits: String(packs * 1000) }
        break
      }
      default:
        return new Response(JSON.stringify({ error: 'Invalid type' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    if (!priceId) {
      return new Response(JSON.stringify({ error: `Price not configured for type ${body.type}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    const quantity = body.type === 'credits' ? Number(body.creditPacks) : 1

    const origin = req.headers.get('origin') ?? Deno.env.get('SITE_URL') ?? 'https://prompted.party'

    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity }],
      metadata,
      ...(user?.email ? { customer_email: user.email } : {}),
      // claim-checkout uses the session id to sign guest buyers into the
      // account created for them.
      success_url: `${origin}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?purchase=cancelled`,
    })

    return new Response(JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (err) {
    console.error('create-checkout-session error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
