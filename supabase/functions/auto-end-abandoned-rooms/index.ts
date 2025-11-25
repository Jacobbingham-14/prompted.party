import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Starting auto-end of abandoned rooms...');

    // Find rooms that have been inactive for more than 48 hours
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    const { data: abandonedRooms, error: fetchError } = await supabase
      .from('rooms')
      .select('id, code, status, updated_at')
      .in('status', ['playing', 'waiting'])
      .lt('updated_at', fortyEightHoursAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching abandoned rooms:', fetchError);
      throw fetchError;
    }

    if (!abandonedRooms || abandonedRooms.length === 0) {
      console.log('No abandoned rooms found');
      return new Response(
        JSON.stringify({ message: 'No abandoned rooms to auto-end' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${abandonedRooms.length} abandoned rooms to auto-end`);

    let endedCount = 0;
    let errorCount = 0;

    // Mark each abandoned room as ended
    for (const room of abandonedRooms) {
      try {
        const { error: updateError } = await supabase
          .from('rooms')
          .update({ status: 'ended' })
          .eq('id', room.id);

        if (updateError) {
          console.error(`Error ending room ${room.code}:`, updateError);
          errorCount++;
        } else {
          console.log(`Successfully ended room ${room.code} (last activity: ${room.updated_at})`);
          endedCount++;
        }
      } catch (error) {
        console.error(`Error processing room ${room.code}:`, error);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Auto-end completed',
        endedCount,
        errorCount,
        totalProcessed: abandonedRooms.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Auto-end function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
