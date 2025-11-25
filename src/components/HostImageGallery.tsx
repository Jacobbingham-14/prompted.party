import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import JoinQRCode from './JoinQRCode';

interface Submission {
  id: string;
  player_id: string;
  player_name?: string;
  image_url: string;
}

interface HostImageGalleryProps {
  submissions: Submission[];
  submittedCount: number;
  totalPlayers: number;
  roundId: string;
  roomCode: string;
  winnerId?: string;
  onNextRound?: () => void;
  onStartJudging?: () => void;
  onEndGame?: () => void;
  prompt?: string;
}

export default function HostImageGallery({ submissions, submittedCount, totalPlayers, roundId, roomCode, winnerId, onNextRound, onStartJudging, onEndGame, prompt }: HostImageGalleryProps) {
  const [judgeViewingIndex, setJudgeViewingIndex] = useState<number | null>(null);
  const [channelReady, setChannelReady] = useState(false);
  const submissionsRef = useRef(submissions);

  // Keep ref in sync with submissions
  useEffect(() => {
    submissionsRef.current = submissions;
  }, [submissions]);

  // Subscribe to judge's current viewing index
  useEffect(() => {
    console.log('[HostImageGallery] Subscribing to judge-viewing channel', roundId);
    const channel = supabase.channel(`judge-viewing-${roundId}`);
    
    channel
      .on('broadcast', { event: 'judge-viewing' }, (payload) => {
        const received = Number(payload?.payload?.currentIndex ?? 0);
        const currentSubmissions = submissionsRef.current;
        const clamped = Math.max(0, Math.min(received, Math.max(0, currentSubmissions.length - 1)));
        console.log('[HostImageGallery] ✅ Received judge index:', received, '→ clamped:', clamped, 'len:', currentSubmissions.length);
        setJudgeViewingIndex(clamped);
      })
      .subscribe((status) => {
        console.log('[HostImageGallery] Channel status:', status);
        if (status === 'SUBSCRIBED') {
          setChannelReady(true);
          console.log('[HostImageGallery] ✅ Channel ready - listening for judge broadcasts');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[HostImageGallery] ❌ Channel subscription error');
          setChannelReady(false);
        }
      });

    return () => {
      console.log('[HostImageGallery] Unsubscribing channel');
      setChannelReady(false);
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  // Fallback and clamp when submissions list changes
  useEffect(() => {
    if (submissions.length === 0) return;
    if (judgeViewingIndex === null) {
      console.log('[HostImageGallery] No broadcast yet; defaulting to first image');
      setJudgeViewingIndex(0);
      return;
    }
    if (judgeViewingIndex < 0 || judgeViewingIndex >= submissions.length) {
      const clamped = Math.max(0, Math.min(judgeViewingIndex, submissions.length - 1));
      console.log('[HostImageGallery] Clamping existing index to', clamped, 'len:', submissions.length);
      setJudgeViewingIndex(clamped);
    }
  }, [submissions.length, judgeViewingIndex]);

  // Detect pre-judging mode
  const preJudging = Boolean(onStartJudging) && !winnerId;
  console.log('[HostImageGallery] Button check', { preJudging, submittedCount, totalPlayers, submissionsLen: submissions.length });

  // If there's a winner, show winner screen
  if (winnerId) {
    const winnerSubmission = submissions.find(s => s.id === winnerId);
    if (winnerSubmission) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <JoinQRCode roomCode={roomCode} />
          <div className="max-w-4xl w-full space-y-8 text-center">
            <h1 className="text-6xl font-bold text-primary animate-bounce">
              Winner!
            </h1>
            <div className="border-8 border-primary rounded-lg overflow-hidden bg-card shadow-2xl">
              <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                <img 
                  src={winnerSubmission.image_url} 
                  alt={`Winning submission by ${winnerSubmission.player_name || 'Player'}`}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-8 bg-primary/10">
                <p className="text-4xl font-bold text-foreground">
                  {winnerSubmission.player_name || 'Anonymous'}
                </p>
              </div>
            </div>
            {onNextRound && (
              <Button
                onClick={onNextRound}
                size="lg"
                className="text-2xl py-6 px-12"
              >
                Start Next Round
              </Button>
            )}
          </div>
        </div>
      );
    }
  }

  // Show only the image the judge is viewing (fallback to first image if none broadcast yet)
  const indexToShow = judgeViewingIndex !== null ? judgeViewingIndex : (submissions.length > 0 ? 0 : null);
  const currentSubmission = indexToShow !== null ? submissions[indexToShow] : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <JoinQRCode roomCode={roomCode} />
      <div className="max-w-4xl w-full space-y-6">
        {prompt && (
          <div className="border-2 border-primary/50 rounded-lg p-3 bg-primary/5 text-center">
            <p className="text-xs font-semibold text-primary mb-1">Round Prompt:</p>
            <p className="text-sm text-foreground">{prompt}</p>
          </div>
        )}

        {submissions.length === 0 ? (
          <div className="text-center space-y-2">
            <p className="text-lg text-muted-foreground">
              Waiting for players to submit their images...
            </p>
          </div>
        ) : !preJudging && currentSubmission ? (
          <div 
            key={currentSubmission.id}
            className="w-full animate-enter"
          >
            <div className="relative h-[75vh] bg-muted rounded-lg overflow-hidden shadow-2xl">
              <img 
                src={currentSubmission.image_url} 
                alt={`Submission by ${currentSubmission.player_name || 'Player'}`}
                className="w-full h-full object-contain transition-opacity duration-300"
              />
              <div className="absolute top-4 right-4 bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full flex items-center gap-1.5 animate-pulse text-xs backdrop-blur-sm">
                <Eye className="h-3.5 w-3.5" />
                <span className="font-semibold">Judge viewing</span>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-full">
                <p className="text-sm font-medium text-foreground">
                  Image {indexToShow! + 1} of {submissions.length}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {preJudging ? 'Waiting to start judging' : 'Judge is Reviewing'}
          </h1>
          <div className="inline-block border-2 border-border rounded-lg p-3 bg-card">
            <p className="text-2xl font-bold text-primary">
              {submittedCount}/{totalPlayers}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Players submitted
            </p>
          </div>
        </div>

        {/* Start Judging Button - Show when submissions exist and judging hasn't started */}
        {onStartJudging && submissions.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999]">
            <Button 
              onClick={onStartJudging}
              size="lg"
              className="text-xl py-6 px-8 shadow-2xl animate-pulse"
            >
              {submittedCount === totalPlayers && totalPlayers > 0
                ? 'Start Judging (All images in)'
                : `Start Judging Now (${submittedCount}/${totalPlayers})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
