import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';

interface Submission {
  id: string;
  player_id: string;
  image_url: string;
  is_winner: boolean;
  player_name?: string;
}

interface WinnerRevealProps {
  winningSubmission: Submission;
  winnerName: string;
  prompt: string;
  isHost: boolean;
  onContinue: () => void;
  additionalWinners?: Array<{
    submission: Submission;
    playerName: string;
  }>;
}

export default function WinnerReveal({
  winningSubmission,
  winnerName,
  prompt,
  isHost,
  onContinue,
  additionalWinners
}: WinnerRevealProps) {
  const isTie = additionalWinners && additionalWinners.length > 0;
  const allWinners = [
    { submission: winningSubmission, playerName: winnerName },
    ...(additionalWinners || [])
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col p-4">
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 pb-20">
        {/* Winner Announcement */}
        <div className="text-center space-y-4 animate-fade-in">
          <div className="flex items-center justify-center gap-3">
            <Trophy className="w-12 h-12 text-primary animate-scale-in" />
            <h1 className="text-5xl font-bold text-foreground">
              {isTie ? 'Winners!' : 'Winner!'}
            </h1>
            <Trophy className="w-12 h-12 text-primary animate-scale-in" />
          </div>
          {!isTie ? (
            <p className="text-3xl font-semibold text-primary">{winnerName}</p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {allWinners.map((winner, idx) => (
                <p key={idx} className="text-3xl font-semibold text-primary">
                  {winner.playerName}
                  {idx < allWinners.length - 1 && <span className="mx-2">&</span>}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Winning Image(s) */}
        {!isTie ? (
          <Card className="max-w-3xl w-full animate-scale-in">
            <CardContent className="p-6 space-y-4">
              <img
                src={winningSubmission.image_url}
                alt={`Winning submission by ${winnerName}`}
                className="w-full h-auto rounded-lg shadow-lg"
              />
              <p className="text-center text-lg text-muted-foreground italic">
                "{prompt}"
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl w-full">
            {allWinners.map((winner, idx) => (
              <Card key={idx} className="animate-scale-in">
                <CardContent className="p-6 space-y-3">
                  <p className="text-center text-xl font-semibold text-foreground">
                    {winner.playerName}
                  </p>
                  <img
                    src={winner.submission.image_url}
                    alt={`Winning submission by ${winner.playerName}`}
                    className="w-full h-auto rounded-lg shadow-lg"
                  />
                  <p className="text-center text-sm text-muted-foreground italic">
                    "{prompt}"
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar with Continue Button or Waiting Message */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4">
        <div className="max-w-7xl mx-auto flex justify-center">
          {isHost ? (
            <Button
              onClick={onContinue}
              size="lg"
              className="animate-fade-in text-lg px-8 py-6"
            >
              Continue to Scoreboard
            </Button>
          ) : (
            <p className="text-xl text-muted-foreground animate-fade-in py-4">
              Waiting for host to continue...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
