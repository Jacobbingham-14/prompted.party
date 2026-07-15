import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    const openAIKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIKey) {
      throw new Error('OPENAI_API_KEY is not configured')
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

    // Look up host and check generation limit before spending an API request.
    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('host_id')
      .eq('id', body.roomId)
      .single()

    const hostId: string | null = room?.host_id ?? null

    if (!hostId) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    let remaining: number | null = null

    const { data: limitData, error: limitError } = await supabaseAdmin.rpc('check_generation_limit', {
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
    if (limit && !limit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Generation limit reached',
          message: `You have used all ${limit.max_limit} generations for this account.`,
          limit: limit.max_limit,
          used: limit.current_count,
          remaining: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      )
    }
    remaining = limit ? Math.max(0, limit.remaining - 1) : null

    const openAIResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt: body.prompt,
        n: 1,
        size: '1024x1024',
        quality: 'low',
        output_format: 'webp',
        output_compression: 80,
      }),
    })

    const openAIData = await openAIResponse.json()
    if (!openAIResponse.ok) {
      throw new Error(openAIData?.error?.message ?? `OpenAI image generation failed (${openAIResponse.status})`)
    }

    const encodedImage = openAIData?.data?.[0]?.b64_json
    if (!encodedImage || typeof encodedImage !== 'string') {
      throw new Error('OpenAI did not return an image')
    }

    const imageBytes = Uint8Array.from(atob(encodedImage), (character) => character.charCodeAt(0))
    const objectPath = `generated/${body.roomId}/${crypto.randomUUID()}.webp`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('game-images')
      .upload(objectPath, imageBytes, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Unable to store generated image: ${uploadError.message}`)
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('game-images')
      .getPublicUrl(objectPath)

    const output = publicUrlData.publicUrl

    // Increment counter after successful generation
    if (hostId) {
      const { error: statsError } = await supabaseAdmin.rpc('increment_generation_count', {
        p_user_id: hostId
      })
      if (statsError) {
        console.error('Failed to increment generation count:', statsError)
      }
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
