// supabase/functions/claim-checkout/index.ts
//
// Called by the browser when Stripe redirects back after checkout, with the
// Checkout Session id from the success URL. Reports whether the purchase has
// been fulfilled yet (by stripe-webhook) and, for guest checkouts, signs the
// buyer into the account that was created for them.
//
// Returns one of:
//   { status: 'pending' }            webhook hasn't fulfilled it yet; retry
//   { status: 'unpaid' }             checkout wasn't completed
//   { status: 'complete' }           buyer was already signed in; nothing to hand off
//   { status: 'sign_in', email, tokenHash }
//                                    new account; client calls verifyOtp with tokenHash
//   { status: 'existing_account', email }
//                                    purchase went to an account that existed before
//                                    checkout, so the buyer has to sign in themselves
//
// Security: the session id is the only credential here, so a sign-in is only
// handed out once, within a day of purchase, and only for an account created
// by this checkout. Handing out sessions for pre-existing accounts would let
// anyone type someone else's email at checkout and get into their account.
//
// Deployed with verify_jwt = false: guest buyers have no Supabase session.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY is not configured')

    const { sessionId } = await req.json()
    if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
      return json({ error: 'Invalid session id' }, 400)
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.status !== 'complete') {
      return json({ status: 'unpaid' })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('purchase_events')
      .select('host_id')
      .eq('stripe_session_id', sessionId)
      .maybeSingle()
    if (purchaseError) throw purchaseError
    if (!purchase) {
      return json({ status: 'pending' })
    }

    if (session.metadata?.host_id) {
      return json({ status: 'complete' })
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(purchase.host_id)
    if (userError) throw userError
    if (!user?.email) throw new Error('Account for purchase not found')

    const purchasedAtMs = session.created * 1000
    const createdByCheckout = new Date(user.created_at).getTime() >= purchasedAtMs
    if (!createdByCheckout || Date.now() - purchasedAtMs > CLAIM_WINDOW_MS) {
      return json({ status: 'existing_account', email: user.email })
    }

    // Single use: only the first caller gets a sign-in.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('purchase_events')
      .update({ claimed_at: new Date().toISOString() })
      .eq('stripe_session_id', sessionId)
      .is('claimed_at', null)
      .select('id')
    if (claimError) throw claimError
    if (!claimed?.length) {
      return json({ status: 'existing_account', email: user.email })
    }

    // generateLink doesn't send an email; it just mints a one-time token the
    // browser exchanges for a session.
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    })
    if (linkError) throw linkError

    return json({ status: 'sign_in', email: user.email, tokenHash: link.properties.hashed_token })
  } catch (err) {
    console.error('claim-checkout error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
