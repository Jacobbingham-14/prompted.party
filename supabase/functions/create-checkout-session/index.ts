// supabase/functions/create-checkout-session/index.ts
//
// Creates a Stripe Checkout Session for one of:
//   - a single game mode unlock ($7)
//   - an "any 2" game mode bundle ($12)
//   - the all-4 game mode bundle ($20)
//   - an image-generation credit pack (250 credits / $1, any multiple)
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

    // Identify the purchasing host from their Supabase auth session
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    }

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
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    }

    const body = await req.json()
    // body.type: 'single_mode' | 'bundle_2' | 'bundle_4' | 'credits'
    // body.modes: string[]  (required for single_mode [len 1] and bundle_2 [len 2])
    // body.creditPacks: number (required for 'credits' — number of 250-credit packs)

    let priceId: string
    let mode: 'payment' = 'payment'
    let metadata: Record<string, string> = { host_id: user.id }

    switch (body.type) {
      case 'single_mode': {
        const gameMode = body.modes?.[0] as GameMode
        if (!GAME_MODES.includes(gameMode)) {
          return new Response(JSON.stringify({ error: 'Invalid game mode' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
        }
        const envKey = `STRIPE_PRICE_MODE_${gameMode.toUpperCase()}`
        priceId = Deno.env.get(envKey) ?? ''
        metadata = { ...metadata, kind: 'game_mode', modes: gameMode }
        break
      }
      case 'bundle_2': {
        const modes = (body.modes ?? []) as GameMode[]
        if (modes.length !== 2 || !modes.every(m => GAME_MODES.includes(m))) {
          return new Response(JSON.stringify({ error: 'bundle_2 requires exactly 2 valid modes' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
        }
        priceId = Deno.env.get('STRIPE_PRICE_BUNDLE_2') ?? ''
        metadata = { ...metadata, kind: 'game_mode_bundle', modes: modes.join(',') }
        break
      }
      case 'bundle_4': {
        priceId = Deno.env.get('STRIPE_PRICE_BUNDLE_4') ?? ''
        metadata = { ...metadata, kind: 'game_mode_bundle', modes: GAME_MODES.join(',') }
        break
      }
      case 'credits': {
        const packs = Number(body.creditPacks)
        if (!Number.isInteger(packs) || packs < 1 || packs > 40) {
          // cap at 40 packs (=10,000 credits/$40) per checkout to limit abuse/fat-finger errors
          return new Response(JSON.stringify({ error: 'creditPacks must be an integer between 1 and 40' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
        }
        priceId = Deno.env.get('STRIPE_PRICE_CREDIT_PACK') ?? '' // price = $1 per 250 credits, quantity = packs
        metadata = { ...metadata, kind: 'credits', credits: String(packs * 250) }
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
      success_url: `${origin}/?purchase=success`,
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
