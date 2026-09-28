import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Replicate from "https://esm.sh/replicate@0.25.2"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const black_forest_labs_flux_schnell = Deno.env.get('black_forest_labs_flux_schnell')
    if (!black_forest_labs_flux_schnell) {
      throw new Error('black_forest_labs_flux_schnell is not configured')
    }

    const body = await req.json()

    if (!body.prompt || typeof body.prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: "Missing required field: prompt is required" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (body.prompt.length > 500) {
      return new Response(
        JSON.stringify({ error: "Prompt too long (max 500 characters)" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!body.roomId || typeof body.roomId !== 'string') {
      return new Response(
        JSON.stringify({ error: "Missing required field: roomId is required" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Look up host and reserve a generation credit BEFORE calling Replicate
    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('host_id, status')
      .eq('id', body.roomId)
      .single()

    const hostId: string | null = room?.host_id ?? null

    if (!hostId || room?.status === 'ended') {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Atomic check-and-increment, so simultaneous generations can't all slip
    // past the limit. Refunded below if the generation fails.
    const { data: limitData, error: limitError } = await supabaseAdmin.rpc('consume_generation_credit', {
      p_user_id: hostId
    })

    if (limitError) {
      console.error('Limit check error:', limitError)
      return new Response(
        JSON.stringify({ error: "Unable to verify generation limit" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const limit = Array.isArray(limitData) ? limitData[0] : limitData
    if (!limit?.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Generation limit reached',
          message: `You have used all ${limit?.max_limit} generations for this account.`,
          limit: limit?.max_limit,
          used: limit?.current_count,
          remaining: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      )
    }
    const remaining: number = limit.remaining

    let output: string
    try {
      const replicate = new Replicate({ auth: black_forest_labs_flux_schnell })

      const input: Record<string, unknown> = {
        prompt: body.prompt,
        go_fast: true,
        megapixels: "1",
        num_outputs: 1,
        aspect_ratio: "1:1",
        output_format: "webp",
        output_quality: 80,
        num_inference_steps: 4,
      }

      if (body.seed !== undefined && body.seed !== null) {
        input.seed = body.seed
      }

      const result = await replicate.run("black-forest-labs/flux-schnell", { input })
      const replicateUrl = Array.isArray(result) ? result[0] : result
      if (typeof replicateUrl !== 'string') throw new Error('No image returned')

      // Copy into our own bucket with the service role. Clients have no upload
      // access to game-images, so everything that can reach the party screen
      // was produced by this function. It also outlives Replicate's ~1 hour
      // delivery URLs (avatars were previously saved as Replicate links).
      const imageResp = await fetch(replicateUrl)
      if (!imageResp.ok) throw new Error('Could not download generated image')
      const bytes = new Uint8Array(await imageResp.arrayBuffer())
      const path = `generated/${body.roomId}/${crypto.randomUUID()}.webp`
      const { error: uploadError } = await supabaseAdmin.storage
        .from('game-images')
        .upload(path, bytes, { contentType: 'image/webp' })
      if (uploadError) throw uploadError

      output = supabaseAdmin.storage.from('game-images').getPublicUrl(path).data.publicUrl
    } catch (genError) {
      const { error: refundError } = await supabaseAdmin.rpc('refund_generation_credit', { p_user_id: hostId })
      if (refundError) console.error('Failed to refund generation credit:', refundError)
      throw genError
    }

    return new Response(
      JSON.stringify({ output, remaining }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error("Error in generate-image function:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
