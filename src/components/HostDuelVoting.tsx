import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import FullscreenButton from '@/components/FullscreenButton';
import { useSharedDeadline } from '@/hooks/useSharedDeadline';
import { Trophy, ImageOff } from 'lucide-react';

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

interface HostDuelVotingProps {
  matchup: DuelMatchup;
  submissions: DuelSubmissionLite[];
  votes: DuelVote[];
  players: Player[];
  roundNumber: number;
  pointsPerVote: number;
  matchupIndex: number;
  totalMatchups: number;
  eligibleVoters: number;
  deadlineAt?: string | null;
  onReveal: () => void;
  onNext: () => void;
}

export default function HostDuelVoting({
  matchup,
  submissions,
  votes,
  players,
  roundNumber,
  pointsPerVote,
  matchupIndex,
  totalMatchups,
  eligibleVoters,
  deadlineAt,
  onReveal,
  onNext,
}: HostDuelVotingProps) {
  const revealed = matchup.status === 'revealed';
  const { timeLeft } = useSharedDeadline(deadlineAt, 30);

  const getPlayer = (id: string) => players.find((p) => p.id === id);
  const subFor = (id: string) => submissions.find((s) => s.player_id === id && s.matchup_id === matchup.id);
  const votesFor = (id: string) => votes.filter((v) => v.matchup_id === matchup.id && v.voted_player_id === id).length;
  const votesCast = votes.filter((v) => v.matchup_id === matchup.id).length;

  const isLast = matchupIndex >= totalMatchups - 1;

  const side = (playerId: string) => {
    const player = getPlayer(playerId);
    const sub = subFor(playerId);
    const count = votesFor(playerId);
    const isWinner = revealed && matchup.winner_player_id === playerId;
    return (
      <div
        className={`flex-1 rounded-2xl border-4 overflow-hidden transition-all ${
          isWinner ? 'border-primary shadow-lg scale-[1.02]' : 'border-border'
        }`}
      >
        <div className="relative aspect-square bg-muted">
          {sub?.image_url ? (
            <img src={sub.image_url} alt={`${player?.name}'s answer`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
              <ImageOff className="w-10 h-10 mb-2" />
              <span className="text-sm">No submission</span>
            </div>
          )}
          {isWinner && (
            <div className="absolute top-3 left-3 bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm font-bold flex items-center gap-1">
              <Trophy className="w-4 h-4" /> Winner
            </div>
          )}
          {revealed && (
            <div className="absolute bottom-3 right-3 bg-background/90 rounded-full px-4 py-1.5 text-lg font-extrabold">
              {count} {count === 1 ? 'vote' : 'votes'}
            </div>
          )}
        </div>
        <div className="p-4 bg-card space-y-2">
          <div className="flex items-center gap-2">
            <PlayerAvatar name={player?.name || '?'} avatarUrl={player?.avatar_url} size="sm" />
            <span className="font-semibold">{player?.name || 'Unknown'}</span>
          </div>
          {revealed && sub?.answer_text && (
            <p className="text-muted-foreground italic">"{sub.answer_text}"</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <FullscreenButton />
      <div className="w-full max-w-5xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="px-3 py-1">Duel {matchupIndex + 1} / {totalMatchups}</Badge>
            <Badge variant="secondary" className="px-3 py-1">🏆 {pointsPerVote} pts per vote</Badge>
            {!revealed && (
              <Badge variant={timeLeft <= 10 ? 'destructive' : 'secondary'} className="px-3 py-1">⏱️ {timeLeft}s</Badge>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-snug px-4">{matchup.prompt_text}</h1>
          {!revealed ? (
            <p className="text-muted-foreground">
              {votesCast} / {eligibleVoters} votes cast — vote on your phones!
            </p>
          ) : (
            <p className="text-xl font-semibold text-foreground">
              {matchup.winner_player_id
                ? `${getPlayer(matchup.winner_player_id)?.name} wins this duel!`
                : "It's a tie!"}
            </p>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-6">
          {side(matchup.player_a_id)}
          <div className="flex items-center justify-center">
            <span className="text-2xl font-black text-muted-foreground">VS</span>
          </div>
          {side(matchup.player_b_id)}
        </div>

        <div className="flex justify-center">
          {!revealed ? (
            <Button onClick={onReveal} size="lg" className="px-10">Reveal Winner</Button>
          ) : (
            <Button onClick={onNext} size="lg" className="px-10">
              {isLast ? 'Finish Round' : 'Next Duel'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
