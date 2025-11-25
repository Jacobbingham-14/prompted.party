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
      console.error('black_forest_labs_flux_schnell is not set')
      throw new Error('black_forest_labs_flux_schnell is not configured')
    }

    const replicate = new Replicate({
      auth: black_forest_labs_flux_schnell,
    })

    const body = await req.json()
    console.log("Request body:", body)

    if (!body.prompt || typeof body.prompt !== 'string') {
      return new Response(
        JSON.stringify({ 
          error: "Missing required field: prompt is required" 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (body.prompt.length > 500) {
      return new Response(
        JSON.stringify({ 
          error: "Prompt too long (max 500 characters)" 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log("Generating image with Flux Schnell, prompt:", body.prompt, "seed:", body.seed || "random")
    
    const input: any = {
      prompt: body.prompt,
      go_fast: true,
      megapixels: "1",
      num_outputs: 1,
      aspect_ratio: "1:1",
      output_format: "webp",
      output_quality: 80,
      num_inference_steps: 4
    }

    // Add seed if provided for consistency
    if (body.seed !== undefined && body.seed !== null) {
      input.seed = body.seed
    }

    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      { input }
    )

    console.log("Generation successful:", output)
    
    // Increment the host's generation counter if roomId is provided
    if (body.roomId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Get the host_id from the room
        const { data: room } = await supabaseAdmin
          .from('rooms')
          .select('host_id')
          .eq('id', body.roomId)
          .single()

        if (room?.host_id) {
          // Use the increment function
          const { error: statsError } = await supabaseAdmin.rpc('increment_generation_count', {
            p_user_id: room.host_id
          })
          
          if (statsError) {
            console.error('Failed to update generation stats:', statsError)
          } else {
            console.log('Successfully incremented generation count for host:', room.host_id)
          }
        }
      } catch (statsError) {
        // Log but don't fail the request
        console.error('Error updating generation stats:', statsError)
      }
    }
    
    return new Response(JSON.stringify({ output }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Error in generate-image function:", error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
