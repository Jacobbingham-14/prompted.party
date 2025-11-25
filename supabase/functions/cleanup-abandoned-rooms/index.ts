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

    console.log('Starting cleanup of abandoned rooms...');

    // Find rooms that have been "ended" for more than 12 hours
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

    const { data: abandonedRooms, error: fetchError } = await supabase
      .from('rooms')
      .select('id, code')
      .eq('status', 'ended')
      .lt('updated_at', twelveHoursAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching abandoned rooms:', fetchError);
      throw fetchError;
    }

    if (!abandonedRooms || abandonedRooms.length === 0) {
      console.log('No abandoned rooms found');
      return new Response(
        JSON.stringify({ message: 'No abandoned rooms to clean up' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${abandonedRooms.length} abandoned rooms to clean up`);

    let cleanedCount = 0;
    let errorCount = 0;

    // Clean up each abandoned room
    for (const room of abandonedRooms) {
      try {
        // Fetch submissions to get image URLs
        const { data: roundsData } = await supabase
          .from('rounds')
          .select('id')
          .eq('room_id', room.id);

        if (roundsData && roundsData.length > 0) {
          const roundIds = roundsData.map(r => r.id);
          
          // Delete image votes
          await supabase
            .from('image_votes')
            .delete()
            .in('round_id', roundIds);

          // Delete prompt votes
          await supabase
            .from('prompt_votes')
            .delete()
            .in('round_id', roundIds);
          
          const { data: submissionsData } = await supabase
            .from('submissions')
            .select('image_url')
            .in('round_id', roundIds);

          // Delete images from storage
          if (submissionsData && submissionsData.length > 0) {
            const imagePaths = submissionsData
              .map(s => {
                const url = s.image_url;
                const match = url.match(/game-images\/(.+)$/);
                return match ? match[1] : null;
              })
              .filter(Boolean) as string[];

            if (imagePaths.length > 0) {
              const { error: storageError } = await supabase
                .storage
                .from('game-images')
                .remove(imagePaths);
              
              if (storageError) {
                console.error(`Error deleting images for room ${room.code}:`, storageError);
              }
            }
          }
        }

        // Call the service-role cascade delete function
        const { error: deleteError } = await supabase.rpc('delete_ended_room_service', {
          p_room_id: room.id
        });

        if (deleteError) {
          console.error(`Error deleting room ${room.code}:`, deleteError);
          errorCount++;
        } else {
          console.log(`Successfully cleaned up room ${room.code}`);
          cleanedCount++;
        }
      } catch (error) {
        console.error(`Error processing room ${room.code}:`, error);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Cleanup completed',
        cleanedCount,
        errorCount,
        totalProcessed: abandonedRooms.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cleanup function error:', error);
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
