import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSharedDeadline } from "@/hooks/useSharedDeadline";

interface PromptVote {
  id: string;
  prompt_text: string;
  player_id: string;
}

interface Player {
  id: string;
  name: string;
}

interface HostPromptVotingProps {
  roundNumber: number;
  prompts: string[];
  votes: PromptVote[];
  players: Player[];
  onSkip: () => void;
  deadlineAt?: string | null;
}

export default function HostPromptVoting({
  roundNumber,
  prompts,
  votes,
  players,
  onSkip,
  deadlineAt,
}: HostPromptVotingProps) {
  const { timeLeft } = useSharedDeadline(deadlineAt, 30);

  const voteCounts = prompts.reduce((acc, prompt) => {
    acc[prompt] = votes.filter((v) => v.prompt_text === prompt).length;
    return acc;
  }, {} as Record<string, number>);

  const getVotersForPrompt = (prompt: string) => {
    const voterIds = votes
      .filter((v) => v.prompt_text === prompt)
      .map((v) => v.player_id);
    return players
      .filter((p) => voterIds.includes(p.id))
      .map((p) => p.name);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Host View: Prompt Voting
          </h1>
          <div className="flex items-center justify-center gap-6 text-lg">
            <Badge variant="secondary" className="px-4 py-2">
              ⏱️ {timeLeft}s
            </Badge>
            <Badge variant="outline" className="px-4 py-2">
              {votes.length}/{players.length} voted
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {prompts.map((prompt, index) => {
            const voters = getVotersForPrompt(prompt);
            return (
              <Card key={index} className="p-8 relative">
                <div className="absolute top-4 right-4">
                  <Badge variant="secondary">
                    {voteCounts[prompt]} votes
                  </Badge>
                </div>
                <p className="text-xl font-medium mb-4">{prompt}</p>
                {voters.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Voted by: {voters.join(", ")}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Button
            onClick={onSkip}
            size="lg"
            disabled={votes.length === 0}
          >
            Complete Voting
          </Button>
        </div>
      </div>
    </div>
  );
}
