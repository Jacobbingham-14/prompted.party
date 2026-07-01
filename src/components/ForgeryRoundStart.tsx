import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, EyeOff, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyErrorMessage, logErrorInDev } from '@/lib/errorUtils';

interface ForgeryRoundStartProps {
  roundId: string;
  playerId: string;
  isHost: boolean;
  playerCount: number;
  roundNumber: number;
  onHostStart: () => void; // host transitions round to 'submitting'
}

interface PlayerPrompt {
  prompt_text: string;
  is_forger: boolean;
}

export default function ForgeryRoundStart({
  roundId,
  playerId,
  isHost,
  playerCount,
  roundNumber,
  onHostStart,
}: ForgeryRoundStartProps) {
  const [playerPrompt, setPlayerPrompt] = useState<PlayerPrompt | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (isHost || !playerId || !roundId) return;
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('player_round_prompts')
        .select('prompt_text, is_forger')
        .eq('round_id', roundId)
        .eq('player_id', playerId)
        .maybeSingle();
      if (error) {
        logErrorInDev('ForgeryRoundStart fetch', error);
        toast({
          title: 'Could not load your prompt',
          description: getUserFriendlyErrorMessage(error),
          variant: 'destructive',
        });
      }
      setPlayerPrompt(data ?? null);
      setLoading(false);
    };
    fetch();
  }, [roundId, playerId, isHost, toast]);

  // Host view
  if (isHost) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="text-6xl">🕵️</div>
          <h1 className="text-3xl font-bold text-foreground">Round {roundNumber}</h1>
          <p className="text-lg text-muted-foreground">
            Secret prompts have been assigned. Players are reviewing their roles.
          </p>
          <p className="text-sm text-muted-foreground">
            {playerCount} player{playerCount !== 1 ? 's' : ''} in this round
          </p>
          <Button onClick={onHostStart} size="lg" className="w-full">
            Everyone&apos;s Ready — Start Creating
          </Button>
        </div>
      </div>
    );
  }

  // Player loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Player view — tap to reveal
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-3xl font-bold text-foreground">Round {roundNumber}</h1>
        <p className="text-muted-foreground">Your secret role has been assigned. Keep it hidden!</p>

        <div
          onClick={() => setRevealed(true)}
          className={`relative cursor-pointer rounded-2xl border-2 transition-all duration-500 p-8 min-h-[200px] flex flex-col items-center justify-center gap-4 ${
            revealed
              ? playerPrompt?.is_forger
                ? 'border-red-500 bg-red-500/10'
                : 'border-green-500 bg-green-500/10'
              : 'border-border bg-muted hover:bg-muted/80'
          }`}
        >
          {!revealed ? (
            <>
              <EyeOff className="w-12 h-12 text-muted-foreground" />
              <p className="text-lg font-medium text-muted-foreground">Tap to reveal your role</p>
              <p className="text-xs text-muted-foreground">Make sure no one is looking!</p>
            </>
          ) : (
            <>
              <Eye className="w-8 h-8" />
              <div className="space-y-2">
                <p className="text-2xl font-bold">
                  {playerPrompt?.is_forger ? '🕵️ You are the FORGER' : '🎨 You are an ARTIST'}
                </p>
                <div className="mt-4 p-4 rounded-lg bg-background border border-border">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Your prompt</p>
                  <p className="text-lg font-semibold text-foreground">{playerPrompt?.prompt_text}</p>
                </div>
                {playerPrompt?.is_forger && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                    Blend in! Generate an image that looks like it fits with the others.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {revealed && (
          <p className="text-sm text-muted-foreground">
            Waiting for the host to start the round…
          </p>
        )}
      </div>
    </div>
  );
}
