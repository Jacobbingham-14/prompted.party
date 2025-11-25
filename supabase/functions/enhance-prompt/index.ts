import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `You are an expert at writing prompts for AI image generation models like Flux and Stable Diffusion.

Your job is to take casual user input and transform it into detailed, optimized prompts that will generate beautiful images.

Guidelines:
- Expand vague descriptions into vivid, specific visual details
- Preserve the user's core intent and all key elements they mention
- Add artistic direction (lighting, composition, camera angle, style)
- Include mood, atmosphere, and aesthetic qualities
- Keep prompts concise but descriptive (under 200 words)
- Use natural language, not comma-separated tags
- When given context from a previous prompt, intelligently merge the refinement request

Examples:

User: "a cat"
Enhanced: "A majestic orange tabby cat sitting on a sunlit windowsill, soft natural lighting highlighting its fur texture, peaceful domestic scene, photorealistic style with shallow depth of field"

User: "make it more colorful" (with context: "sunset over mountains")
Enhanced: "A vibrant sunset over majestic mountains with intensified colors, deep oranges and purples in the sky, rich golden hour lighting, enhanced saturation, dramatic clouds with vivid hues"

User: "futuristic city"
Enhanced: "A sprawling futuristic cityscape at night, towering skyscrapers with glowing neon lights, flying vehicles between buildings, cyberpunk aesthetic, atmospheric fog, dramatic perspective from street level looking up, high-tech architecture with holographic advertisements"

Now transform the user's input into an optimized prompt.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ChatAPI = Deno.env.get("ChatAPI");
    if (!ChatAPI) {
      console.error("ChatAPI is not set");
      throw new Error("ChatAPI is not configured");
    }

    const body = await req.json();
    const { userInput, context } = body;

    if (!userInput || typeof userInput !== 'string') {
      return new Response(
        JSON.stringify({ error: "Missing required field: userInput" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (userInput.length > 500) {
      return new Response(
        JSON.stringify({ error: "Input too long (max 500 characters)" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (context && (typeof context !== 'string' || context.length > 500)) {
      return new Response(
        JSON.stringify({ error: "Invalid or too long context (max 500 characters)" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log("Enhancing prompt:", { userInput, hasContext: !!context });

    // Build the user message based on whether we have context
    let userMessage = userInput;
    if (context) {
      userMessage = `Previous prompt context: "${context}"\n\nUser refinement request: "${userInput}"\n\nMerge these intelligently into a single enhanced prompt.`;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ChatAPI}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      throw new Error(errorData.error?.message || "OpenAI API request failed");
    }

    const data = await response.json();
    const enhancedPrompt = data.choices[0].message.content.trim();

    console.log("Enhanced prompt:", enhancedPrompt);

    return new Response(
      JSON.stringify({ enhancedPrompt }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in enhance-prompt function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
