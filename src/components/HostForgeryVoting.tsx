import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useSharedDeadline } from '@/hooks/useSharedDeadline';

interface Player {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface ForgeryVote {
  voter_id: string;
  accused_player_id: string;
}

interface HostForgeryVotingProps {
  players: Player[];
  votes: ForgeryVote[];
  onEndVoting: () => void;
  deadlineAt?: string | null;
}

export default function HostForgeryVoting({ players, votes, onEndVoting, deadlineAt }: HostForgeryVotingProps) {
  const { timeLeft } = useSharedDeadline(deadlineAt, 30);
  // Tally votes per accused player
  const voteCounts: Record<string, number> = {};
  for (const vote of votes) {
    voteCounts[vote.accused_player_id] = (voteCounts[vote.accused_player_id] || 0) + 1;
  }

  const sortedPlayers = [...players].sort(
    (a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0)
  );

  const totalVoters = players.length;
  const votesCast = votes.length;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Forgery Voting</h1>
          <p className="text-muted-foreground">
            {votesCast} / {totalVoters} votes cast
          </p>
          <div className="flex items-center justify-center pt-1">
            <Badge variant={timeLeft <= 10 ? 'destructive' : 'secondary'} className="px-4 py-2">
              ⏱️ {timeLeft}s
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          {sortedPlayers.map((player) => {
            const count = voteCounts[player.id] || 0;
            const pct = totalVoters > 0 ? (count / totalVoters) * 100 : 0;
            return (
              <div key={player.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="sm" />
                    <span className="font-medium text-sm">{player.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {count} vote{count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Button onClick={onEndVoting} className="w-full" size="lg">
          End Voting & Reveal
        </Button>
      </div>
    </div>
  );
}
