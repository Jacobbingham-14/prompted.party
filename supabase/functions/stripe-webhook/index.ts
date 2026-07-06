// supabase/functions/stripe-webhook/index.ts
//
// Verifies the Stripe webhook signature, then fulfills the purchase by calling
// the grant_game_modes / grant_generation_credits RPCs (via service role, since
// those tables have no client-writable RLS policy — only this function can write them).
// Uses purchase_events.stripe_session_id as an idempotency key so Stripe's
// at-least-once delivery can't double-grant credits or modes.

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
    const kind = metadata.kind as 'game_mode' | 'game_mode_bundle' | 'credits' | undefined

    if (!hostId || !kind) {
      console.error('Missing metadata on checkout session', session.id)
      return new Response(JSON.stringify({ received: true, warning: 'missing metadata' }), { status: 200 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Idempotency: if we've already recorded this session, do nothing further.
    const { data: existing } = await supabaseAdmin
      .from('purchase_events')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ received: true, alreadyProcessed: true }), { status: 200 })
    }

    const amountCents = session.amount_total ?? 0
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

    if (kind === 'game_mode' || kind === 'game_mode_bundle') {
      const modes = (metadata.modes ?? '').split(',').filter(Boolean)
      const { error } = await supabaseAdmin.rpc('grant_game_modes', {
        p_host_id: hostId,
        p_modes: modes,
        p_payment_intent_id: paymentIntentId,
      })
      if (error) {
        console.error('grant_game_modes failed:', error)
        return new Response(JSON.stringify({ error: 'Failed to grant game modes' }), { status: 500 })
      }
      await supabaseAdmin.from('purchase_events').insert({
        host_id: hostId,
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        kind,
        detail: { modes },
        amount_cents: amountCents,
      })
    } else if (kind === 'credits') {
      const credits = Number(metadata.credits ?? 0)
      if (credits > 0) {
        const { error } = await supabaseAdmin.rpc('grant_generation_credits', {
          p_host_id: hostId,
          p_amount: credits,
        })
        if (error) {
          console.error('grant_generation_credits failed:', error)
          return new Response(JSON.stringify({ error: 'Failed to grant credits' }), { status: 500 })
        }
      }
      await supabaseAdmin.from('purchase_events').insert({
        host_id: hostId,
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        kind,
        detail: { credits },
        amount_cents: amountCents,
      })
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })

  } catch (err) {
    console.error('stripe-webhook error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500 })
  }
})
