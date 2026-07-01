import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSharedDeadline } from "@/hooks/useSharedDeadline";

interface PromptVotingProps {
  roundNumber: number;
  prompts: string[];
  currentVote: string | null;
  voteCounts: Record<string, number>;
  onVote: (promptText: string) => void;
  totalPlayers: number;
  votedPlayers: number;
  deadlineAt?: string | null;
}

export default function PromptVoting({
  roundNumber,
  prompts,
  currentVote,
  voteCounts,
  onVote,
  totalPlayers,
  votedPlayers,
  deadlineAt,
}: PromptVotingProps) {
  const { timeLeft, expired } = useSharedDeadline(deadlineAt, 30);
  const showSkip = expired;

  const handleSkip = () => {
    if (currentVote) {
      return;
    }
    // Random selection if no vote
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    onVote(randomPrompt);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Round {roundNumber}: Vote for a Prompt
          </h1>
          <div className="flex items-center justify-center gap-6 text-lg">
            <Badge variant="secondary" className="px-4 py-2">
              ⏱️ {timeLeft}s
            </Badge>
            <Badge variant="outline" className="px-4 py-2">
              {votedPlayers}/{totalPlayers} voted
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {prompts.map((prompt, index) => (
            <Card
              key={index}
              onClick={() => onVote(prompt)}
              className={`p-8 cursor-pointer transition-all hover:scale-105 relative ${
                currentVote === prompt
                  ? "ring-4 ring-primary bg-primary/10"
                  : "hover:shadow-lg"
              }`}
            >
              <p className="text-xl font-medium text-center p-4">{prompt}</p>
            </Card>
          ))}
        </div>

        {showSkip && !currentVote && (
          <div className="flex justify-center">
            <Button onClick={handleSkip} size="lg" variant="outline">
              Skip Vote (Random Selection)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
