import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import { PlayerAvatar } from '@/components/PlayerAvatar';

interface Player {
  id: string;
  name: string;
  score: number;
  avatar_url?: string | null;
}

interface GameEndedScreenProps {
  players: Player[];
  onLeave: () => void;
}

export default function GameEndedScreen({ players, onLeave }: GameEndedScreenProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
          <h1 className="text-3xl font-bold text-foreground">Game Over!</h1>
          {winner && (
            <p className="text-lg text-muted-foreground">
              <span className="font-semibold text-foreground">{winner.name}</span> wins with {winner.score} point{winner.score !== 1 ? 's' : ''}!
            </p>
          )}
        </div>

        <div className="border border-border rounded-lg bg-card divide-y divide-border">
          {sorted.map((player, idx) => (
            <div key={player.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground w-5">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                </span>
                <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="sm" />
                <span className="font-medium text-foreground">{player.name}</span>
              </div>
              <span className="font-bold text-foreground">{player.score} pts</span>
            </div>
          ))}
        </div>

        <Button onClick={onLeave} className="w-full" size="lg">
          Back to Home
        </Button>
      </div>
    </div>
  );
}
