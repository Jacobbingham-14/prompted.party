interface JudgeWaitingViewProps {
  submittedCount: number;
  totalPlayers: number;
}

export default function JudgeWaitingView({ submittedCount, totalPlayers }: JudgeWaitingViewProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <h1 className="text-5xl font-bold text-foreground">Waiting for Submissions</h1>
        
        <div className="border-4 border-border rounded-lg p-12 bg-card">
          <p className="text-6xl font-bold text-primary mb-4">
            {submittedCount}/{totalPlayers}
          </p>
          <p className="text-2xl text-muted-foreground">
            Players submitted
          </p>
        </div>

        <p className="text-xl text-muted-foreground">
          Waiting for all players to submit their images...
        </p>
      </div>
    </div>
  );
}
