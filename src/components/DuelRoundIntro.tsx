import { Badge } from '@/components/ui/badge';
import FullscreenButton from '@/components/FullscreenButton';
import { useSharedDeadline } from '@/hooks/useSharedDeadline';
import { Swords } from 'lucide-react';

interface DuelRoundIntroProps {
  roundNumber: number;
  totalRounds: number;
  pointsPerVote: number;
  deadlineAt?: string | null;
  isHost?: boolean;
}

export default function DuelRoundIntro({
  roundNumber,
  totalRounds,
  pointsPerVote,
  deadlineAt,
  isHost = false,
}: DuelRoundIntroProps) {
  const { timeLeft } = useSharedDeadline(deadlineAt, 5);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {isHost && <FullscreenButton />}
      <div className="w-full max-w-3xl text-center space-y-8">
        <Badge variant="secondary" className="px-4 py-2 text-base">
          Round {roundNumber} of {totalRounds} · {pointsPerVote} points per vote
        </Badge>

        <div className="space-y-5">
          <Swords className="w-20 h-20 mx-auto text-primary" />
          <h1 className="text-5xl md:text-7xl font-black text-foreground">Prompt Duel</h1>
          <p className="text-xl md:text-2xl text-muted-foreground">
            Two prompts each. Write the funniest answers you can.
          </p>
        </div>

        <div className="mx-auto w-32 h-32 rounded-full border-8 border-primary/30 bg-primary/10 flex items-center justify-center">
          <span className="text-6xl font-black text-primary">{timeLeft}</span>
        </div>

        <p className="text-lg text-muted-foreground">Prompts appear automatically.</p>
      </div>
    </div>
  );
}
