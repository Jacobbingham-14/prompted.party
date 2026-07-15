import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSharedDeadline } from '@/hooks/useSharedDeadline';

interface Player {
  id: string;
  name: string;
  score: number;
}

interface Submission {
  id: string;
  player_id: string;
  image_url: string;
}

interface ScoreboardProps {
  players: Player[];
  winnerId?: string;
  winnerIds?: string[];
  winnerName?: string;
  winningSubmissions?: Submission[];
  prompt?: string;
  gameMode: 'judge' | 'voting' | 'forgery' | 'duel';
  nextJudgeName?: string;
  isHost: boolean;
  onNextRound: () => void;
  onEndGame: () => void;
  onBackToMenu?: () => void | Promise<void>;
  automaticFlow?: boolean;
  autoAdvanceDeadlineAt?: string | null;
  isFinalRound?: boolean;
}

export default function Scoreboard({ 
  players, 
  winnerId, 
  winnerIds = [], 
  winnerName, 
  winningSubmissions = [],
  prompt,
  gameMode,
  nextJudgeName, 
  isHost, 
  onNextRound, 
  onEndGame,
  onBackToMenu,
  automaticFlow = false,
  autoAdvanceDeadlineAt,
  isFinalRound = false,
}: ScoreboardProps) {
  const { timeLeft } = useSharedDeadline(autoAdvanceDeadlineAt, 10);
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const isMultipleWinners = winnerIds.length > 1;
  const isJudgeMode = gameMode === 'judge';
  const winnerNames = isJudgeMode
    ? (winnerName ? [winnerName] : [])
    : (winnerIds.map(id => players.find(p => p.id === id)?.name).filter(Boolean) as string[]);
  const displayWinnerText = winnerNames.length > 0 ? winnerNames.join(', ') : '';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-foreground">
            {isFinalRound ? 'Final Standings' : isMultipleWinners ? 'Tied Winners!' : 'Round Winner'}
          </h1>
          
          {prompt && (
            <Card className="p-6 bg-muted">
              <p className="text-lg text-muted-foreground mb-2">Prompt:</p>
              <p className="text-2xl font-medium text-foreground">{prompt}</p>
            </Card>
          )}

          {!isJudgeMode && winningSubmissions.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {winningSubmissions.map((submission) => {
                  const winner = players.find(p => p.id === submission.player_id);
                  return (
                    <Card key={submission.id} className="p-6 space-y-4">
                      <img
                        src={submission.image_url}
                        alt="Winning submission"
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                      <p className="text-3xl font-bold text-primary">
                        {winner?.name}
                      </p>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            displayWinnerText && (
              <p className="text-4xl font-bold text-foreground border-4 border-border p-6 rounded-lg bg-card">
                {displayWinnerText}
              </p>
            )
          )}

          {isJudgeMode && nextJudgeName && (
            <p className="text-xl text-muted-foreground">
              Next Judge: {nextJudgeName}
            </p>
          )}
        </div>

        <div className="border-2 border-border rounded-lg p-6 bg-card">
          <h2 className="text-2xl font-bold mb-4 text-card-foreground">Scoreboard</h2>
          <div className="space-y-2">
            {sortedPlayers.map((player, index) => (
              <div 
                key={player.id}
                className={`p-4 border-2 rounded flex justify-between items-center text-lg ${
                  (winnerId && player.id === winnerId) || winnerIds.includes(player.id)
                    ? 'border-primary bg-primary/10 font-bold' 
                    : 'border-border bg-muted'
                }`}
              >
                <span className="text-foreground">
                  {index + 1}. {player.name}
                </span>
                <span className="text-foreground font-bold">{player.score} pts</span>
              </div>
            ))}
          </div>
        </div>

        {automaticFlow && (
          <div className="text-center space-y-2">
            {isFinalRound ? (
              <p className="text-xl font-semibold text-foreground">Final standings</p>
            ) : (
              <p className="text-xl font-semibold text-foreground">
                Next round starts automatically in {timeLeft}s
              </p>
            )}
            {!isHost && !isFinalRound && (
              <p className="text-sm text-muted-foreground">No buttons needed — stay on this screen.</p>
            )}
          </div>
        )}

        {isFinalRound && onBackToMenu && (
          <Button
            onClick={onBackToMenu}
            className="w-full h-14 text-xl"
          >
            Back to Menu
          </Button>
        )}

        {isHost && !automaticFlow && (
          <div className="space-y-3">
            <Button 
              onClick={onNextRound}
              className="w-full h-14 text-xl"
            >
              Next Round
            </Button>
            <Button 
              onClick={onEndGame}
              variant="outline"
              className="w-full h-14 text-xl"
            >
              End Game
            </Button>
          </div>
        )}

        {!isHost && !automaticFlow && (
          <p className="text-center text-xl text-muted-foreground">Waiting for host...</p>
        )}
      </div>
    </div>
  );
}
