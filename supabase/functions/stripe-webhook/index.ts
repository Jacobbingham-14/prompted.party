// supabase/functions/stripe-webhook/index.ts
//
// Verifies the Stripe webhook signature, then fulfills the purchase through the
// fulfill_purchase RPC (service role only), which records the purchase and
// grants modes/credits atomically, using purchase_events.stripe_session_id as
// the idempotency key.
//
// Must be deployed with verify_jwt = false (see supabase/config.toml): Stripe
// doesn't send a Supabase JWT, and the signature check below is the auth.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

serve(async (req) => {
  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!stripeSecret || !webhookSecret) {
      throw new Error('Stripe env vars not configured')
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })

    const signature = req.headers.get('stripe-signature')
    const rawBody = await req.text()

    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 })
    }

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response('Invalid signature', { status: 400 })
    }

    if (event.type !== 'checkout.session.completed') {
      // Not an event we act on; acknowledge so Stripe stops retrying it.
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    const session = event.data.object as Stripe.Checkout.Session
    const metadata = session.metadata ?? {}
    const hostId = metadata.host_id
    const kind = metadata.kind as 'full_access' | 'credits' | undefined

    if (!hostId || !kind) {
      console.error('Missing metadata on checkout session', session.id)
      return new Response(JSON.stringify({ received: true, warning: 'missing metadata' }), { status: 200 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const amountCents = session.amount_total ?? 0
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

    let modes: string[] = []
    let credits = 0
    if (kind === 'full_access') {
      modes = (metadata.modes ?? '').split(',').filter(Boolean)
      credits = Number(metadata.credits ?? 1000)
    } else if (kind === 'credits') {
      credits = Number(metadata.credits ?? 0)
    } else {
      console.error('Unknown purchase kind on checkout session', session.id, kind)
      return new Response(JSON.stringify({ received: true, warning: 'unknown kind' }), { status: 200 })
    }

    // Records the session and grants everything in one transaction, keyed on
    // the session id, so Stripe's at-least-once delivery can't double-grant
    // and a partial failure can't leave a paid purchase unrecorded.
    const { data: fulfilled, error: fulfillError } = await supabaseAdmin.rpc('fulfill_purchase', {
      p_stripe_session_id: session.id,
      p_host_id: hostId,
      p_kind: kind,
      p_modes: modes,
      p_credits: credits,
      p_amount_cents: amountCents,
      p_payment_intent_id: paymentIntentId,
    })
    if (fulfillError) {
      console.error('fulfill_purchase failed:', session.id, fulfillError)
      return new Response(JSON.stringify({ error: 'Failed to fulfill purchase' }), { status: 500 })
    }
    if (fulfilled === false) {
      return new Response(JSON.stringify({ received: true, alreadyProcessed: true }), { status: 200 })
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })

  } catch (err) {
    console.error('stripe-webhook error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500 })
  }
})
