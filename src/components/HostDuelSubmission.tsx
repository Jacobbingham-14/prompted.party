import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import FullscreenButton from '@/components/FullscreenButton';
import { useSharedDeadline } from '@/hooks/useSharedDeadline';
import { Check, Loader2 } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface DuelSubmissionLite {
  player_id: string;
  image_status: string;
}

interface HostDuelSubmissionProps {
  players: Player[];
  submissions: DuelSubmissionLite[];
  totalExpected: number; // matchups * 2 answers
  roundNumber: number;
  pointsPerVote: number;
  deadlineAt?: string | null;
  isGenerationGrace?: boolean;
}

export default function HostDuelSubmission({
  players,
  submissions,
  totalExpected,
  roundNumber,
  pointsPerVote,
  deadlineAt,
  isGenerationGrace = false,
}: HostDuelSubmissionProps) {
  const { timeLeft } = useSharedDeadline(deadlineAt, 180);
  const readyCount = submissions.filter((s) => s.image_status === 'ready').length;
  const generatingCount = submissions.filter((s) => s.image_status === 'generating').length;
  const pct = totalExpected > 0 ? (readyCount / totalExpected) * 100 : 0;

  // Per-player: how many of their two answers are ready.
  const readyByPlayer: Record<string, number> = {};
  for (const s of submissions) {
    if (s.image_status === 'ready') readyByPlayer[s.player_id] = (readyByPlayer[s.player_id] || 0) + 1;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <FullscreenButton />
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">
            Round {roundNumber}: {isGenerationGrace ? 'Finishing Images' : 'Writing Answers'}
          </h1>
          <p className="text-muted-foreground">
            {isGenerationGrace
              ? 'Answer time is over. Voting begins as soon as the remaining images finish.'
              : 'Players are answering their two prompts.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Badge variant="secondary" className="px-3 py-1">🏆 {pointsPerVote} pts per vote</Badge>
            <Badge variant={timeLeft <= 20 ? 'destructive' : 'secondary'} className="px-3 py-1">⏱️ {timeLeft}s</Badge>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{readyCount} / {totalExpected} images ready</span>
            {generatingCount > 0 && (
              <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {generatingCount} generating</span>
            )}
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {players.map((p) => {
            const ready = readyByPlayer[p.id] || 0;
            const done = ready >= 2;
            return (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                  <span className="font-medium text-sm">{p.name}</span>
                </div>
                {done ? (
                  <Badge className="bg-green-600 hover:bg-green-600"><Check className="w-3 h-3 mr-1" /> Done</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">{ready}/2</span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Voting starts automatically when everyone is ready or the timer expires.
        </p>
      </div>
    </div>
  );
}
