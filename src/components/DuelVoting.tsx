import { Badge } from '@/components/ui/badge';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useSharedDeadline } from '@/hooks/useSharedDeadline';
import { Check, Trophy, ImageOff } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface DuelMatchup {
  id: string;
  prompt_text: string;
  player_a_id: string;
  player_b_id: string;
  status: string;
  winner_player_id: string | null;
}

interface DuelSubmissionLite {
  matchup_id: string;
  player_id: string;
  answer_text: string;
  image_url: string | null;
  image_status: string;
}

interface DuelVote {
  matchup_id: string;
  voter_id: string;
  voted_player_id: string;
}

interface DuelVotingProps {
  matchup: DuelMatchup;
  submissions: DuelSubmissionLite[];
  votes: DuelVote[];
  players: Player[];
  currentPlayerId: string;
  currentVote: string | null; // voted_player_id
  pointsPerVote: number;
  deadlineAt?: string | null;
  onVote: (matchupId: string, votedPlayerId: string) => void;
}

export default function DuelVoting({
  matchup,
  submissions,
  votes,
  players,
  currentPlayerId,
  currentVote,
  pointsPerVote,
  deadlineAt,
  onVote,
}: DuelVotingProps) {
  const revealed = matchup.status === 'revealed';
  const { timeLeft } = useSharedDeadline(deadlineAt, 30);
  const isCompetitor = currentPlayerId === matchup.player_a_id || currentPlayerId === matchup.player_b_id;

  const getPlayer = (id: string) => players.find((p) => p.id === id);
  const subFor = (id: string) => submissions.find((s) => s.player_id === id && s.matchup_id === matchup.id);
  const votesFor = (id: string) => votes.filter((v) => v.matchup_id === matchup.id && v.voted_player_id === id).length;

  const side = (playerId: string) => {
    const player = getPlayer(playerId);
    const sub = subFor(playerId);
    const isVoted = currentVote === playerId;
    const isWinner = revealed && matchup.winner_player_id === playerId;
    const canVote = !revealed && !isCompetitor;

    return (
      <div
        className={`rounded-xl border-2 overflow-hidden transition-all ${
          isWinner
            ? 'border-primary ring-2 ring-primary/50'
            : isVoted
              ? 'border-primary'
              : canVote
                ? 'border-border hover:border-primary/50 cursor-pointer'
                : 'border-border'
        }`}
        onClick={() => canVote && onVote(matchup.id, playerId)}
      >
        <div className="relative aspect-square bg-muted">
          {sub?.image_url ? (
            <img src={sub.image_url} alt={`${player?.name}'s answer`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
              <ImageOff className="w-8 h-8 mb-1" />
              <span className="text-xs">No submission</span>
            </div>
          )}
          {isWinner && (
            <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-bold flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Winner
            </div>
          )}
          {isVoted && !revealed && (
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
              <Check className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className="p-3 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlayerAvatar name={player?.name || '?'} avatarUrl={player?.avatar_url} size="sm" />
              <span className="font-medium text-sm">{player?.name || 'Unknown'}</span>
            </div>
            {revealed && <span className="text-sm font-bold">{votesFor(playerId)} votes</span>}
          </div>
          {revealed && sub?.answer_text && (
            <p className="text-xs text-muted-foreground italic mt-1">"{sub.answer_text}"</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-5">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="px-3 py-1">🏆 {pointsPerVote} pts per vote</Badge>
            {!revealed && (
              <Badge variant={timeLeft <= 10 ? 'destructive' : 'secondary'} className="px-3 py-1">⏱️ {timeLeft}s</Badge>
            )}
          </div>
          <h1 className="text-xl font-bold text-foreground leading-snug">{matchup.prompt_text}</h1>
          {isCompetitor && !revealed && (
            <p className="text-sm text-primary font-medium">You're in this duel — sit back and watch! 🍿</p>
          )}
          {!isCompetitor && !revealed && (
            <p className="text-sm text-muted-foreground">
              {currentVote ? '✓ Vote locked in — you can change it.' : 'Tap the funnier one to vote.'}
            </p>
          )}
          {revealed && (
            <p className="text-lg font-semibold text-foreground">
              {matchup.winner_player_id
                ? `${getPlayer(matchup.winner_player_id)?.name} wins!`
                : "It's a tie!"}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {side(matchup.player_a_id)}
          {side(matchup.player_b_id)}
        </div>
      </div>
    </div>
  );
}
