import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Submission {
  id: string;
  player_id: string;
  player_name: string;
  image_url: string;
}

interface JudgeViewProps {
  submissions: Submission[];
  onSelectWinner: (submissionId: string) => void;
  roundId: string;
}

export default function JudgeView({ submissions, onSelectWinner, roundId }: JudgeViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [channelReady, setChannelReady] = useState(false);
  const currentIndexRef = useRef(currentIndex);
  const channelRef = useRef<any>(null);

  // Keep ref in sync for closures
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Subscribe once to realtime channel
  useEffect(() => {
    const channel = supabase.channel(`judge-viewing-${roundId}`, {
      config: {
        broadcast: { self: true, ack: true },
        presence: { key: 'judge' }
      }
    });
    channelRef.current = channel;
    console.log('[JudgeView] Subscribing to channel', `judge-viewing-${roundId}`);
    
    channel.subscribe((status) => {
      console.log('[JudgeView] Channel status:', status);
      if (status === 'SUBSCRIBED') {
        setChannelReady(true);
        console.log('[JudgeView] ✅ Channel ready for broadcasting');
        
        // Send initial index once subscribed
        const initial = Math.max(0, Math.min(currentIndexRef.current, Math.max(0, submissions.length - 1)));
        console.log('[JudgeView] Initial broadcast index:', initial);
        
        setTimeout(() => {
          try {
            channel.send({
              type: 'broadcast',
              event: 'judge-viewing',
              payload: { currentIndex: initial }
            });
            console.log('[JudgeView] ✅ Initial broadcast sent');
          } catch (error) {
            console.error('[JudgeView] ❌ Failed to send initial broadcast:', error);
          }
        }, 100);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[JudgeView] ❌ Channel subscription error');
        setChannelReady(false);
      } else if (status === 'TIMED_OUT') {
        console.error('[JudgeView] ⏱️ Channel subscription timed out, retrying...');
        setChannelReady(false);
        channel.subscribe();
      } else {
        console.log('[JudgeView] Channel status update:', status);
      }
    });

    return () => {
      console.log('[JudgeView] Unsubscribing channel');
      setChannelReady(false);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roundId, submissions.length]);

  // Clamp index when submissions change
  useEffect(() => {
    if (!submissions || submissions.length === 0) return;
    if (currentIndex < 0 || currentIndex >= submissions.length) {
      setCurrentIndex(0);
    }
  }, [submissions, currentIndex]);

  // Broadcast on index change
  useEffect(() => {
    if (!channelRef.current || !channelReady) {
      console.log('[JudgeView] Skipping broadcast - channel not ready');
      return;
    }
    if (submissions.length === 0) return;
    
    console.log('[JudgeView] Broadcasting index:', currentIndex);
    try {
      channelRef.current.send({
        type: 'broadcast',
        event: 'judge-viewing',
        payload: { currentIndex }
      });
      console.log('[JudgeView] ✅ Broadcast sent successfully');
    } catch (error) {
      console.error('[JudgeView] ❌ Failed to broadcast index:', error);
    }
  }, [currentIndex, submissions.length, channelReady]);

  // Handle empty submissions
  if (!submissions || submissions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">Waiting for Submissions</h1>
          <p className="text-xl text-muted-foreground">No images have been submitted yet.</p>
        </div>
      </div>
    );
  }

  const canSwipe = currentIndex >= 0;

  const goToNext = () => {
    if (currentIndex < submissions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSelectWinner = () => {
    if (!channelReady || !channelRef.current) {
      console.error('[JudgeView] ❌ Channel not ready - cannot select winner');
      return;
    }

    console.log('[JudgeView] 🏆 Selecting winner - Broadcasting to host');
    console.log('[JudgeView] Submission ID:', currentSubmission.id);
    
    try {
      channelRef.current.send({
        type: 'broadcast',
        event: 'winner-selected',
        payload: { submissionId: currentSubmission.id }
      });
      console.log('[JudgeView] ✅ Winner selection broadcast sent successfully');
    } catch (error) {
      console.error('[JudgeView] ❌ Failed to broadcast winner selection:', error);
    }
  };

  const currentSubmission = submissions[currentIndex];

  return (
    <div className="h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Judge Controls</h1>
          <p className="text-muted-foreground">
            Navigate using the arrows below to control what image appears on the host's display
          </p>
          
          <div className={`text-sm ${channelReady ? 'text-green-500' : 'text-yellow-500'} font-medium`}>
            {channelReady ? '✓ Connected to host' : '⟳ Connecting to host...'}
          </div>
          
          <div className="text-2xl font-semibold text-foreground py-4">
            Image {currentIndex + 1} of {submissions.length}
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={goToPrevious}
            disabled={!channelReady || currentIndex <= 0}
            variant="outline"
            size="lg"
            className="flex-1 h-16"
          >
            <ChevronLeft className="h-6 w-6 mr-2" />
            Previous
          </Button>
          <Button 
            onClick={goToNext}
            disabled={!channelReady || currentIndex >= submissions.length - 1}
            variant="outline"
            size="lg"
            className="flex-1 h-16"
          >
            Next
            <ChevronRight className="h-6 w-6 ml-2" />
          </Button>
        </div>

        <Button 
          onClick={handleSelectWinner}
          disabled={!channelReady}
          size="lg"
          className="w-full h-16 text-lg"
        >
          Select This as Winner
        </Button>
      </div>
    </div>
  );
}
