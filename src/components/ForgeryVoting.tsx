import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Check } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface Submission {
  id: string;
  player_id: string;
  image_url: string;
}

interface ForgeryVotingProps {
  players: Player[];
  submissions: Submission[];
  currentPlayerId: string;
  currentVote: string | null; // accused player id
  onVote: (accusedPlayerId: string) => void;
}

export default function ForgeryVoting({
  players,
  submissions,
  currentPlayerId,
  currentVote,
  onVote,
}: ForgeryVotingProps) {
  const getPlayer = (playerId: string) => players.find((p) => p.id === playerId);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Who is the Forger?</h1>
          <p className="text-muted-foreground">
            Study the images carefully — one player had a different prompt. Tap to vote.
          </p>
          {currentVote && (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
              ✓ You voted for {getPlayer(currentVote)?.name}. You can change your vote.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {submissions.map((sub) => {
            const player = getPlayer(sub.player_id);
            if (!player) return null;
            const isSelf = sub.player_id === currentPlayerId;
            const isVoted = currentVote === sub.player_id;

            return (
              <div
                key={sub.id}
                className={`rounded-xl border-2 overflow-hidden transition-all ${
                  isVoted
                    ? 'border-primary ring-2 ring-primary/50'
                    : isSelf
                      ? 'border-border opacity-60'
                      : 'border-border hover:border-primary/50 cursor-pointer'
                }`}
                onClick={() => !isSelf && onVote(sub.player_id)}
              >
                <img
                  src={sub.image_url}
                  alt={`${player.name}'s submission`}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-3 flex items-center justify-between bg-card">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="sm" />
                    <span className="font-medium text-sm">{player.name}</span>
                    {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                  </div>
                  {isVoted && <Check className="w-4 h-4 text-primary" />}
                  {isSelf && (
                    <span className="text-xs text-muted-foreground">Can&apos;t vote for yourself</span>
                  )}
                  {!isSelf && !isVoted && (
                    <Button size="sm" variant="outline" onClick={() => onVote(sub.player_id)}>
                      Accuse
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!currentVote && (
          <p className="text-center text-sm text-muted-foreground">
            Waiting for your vote…
          </p>
        )}
      </div>
    </div>
  );
}
