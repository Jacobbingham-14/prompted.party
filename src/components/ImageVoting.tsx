import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Submission {
  id: string;
  image_url: string;
  player_id: string;
}

interface ImageVote {
  id: string;
  voter_id: string;
  submission_id: string;
}

interface Player {
  id: string;
  name: string;
}

interface ImageVotingProps {
  submissions: Submission[];
  currentVote: string | null;
  votes: ImageVote[];
  players: Player[];
  currentPlayerId: string;
  onVote: (submissionId: string) => void;
  presentationOrder: string[];
  tiedImageIds?: string[];
}

export default function ImageVoting({
  submissions,
  currentVote,
  votes,
  players,
  currentPlayerId,
  onVote,
  presentationOrder,
  tiedImageIds = [],
}: ImageVotingProps) {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Show loading state if no presentation order
  if (!presentationOrder || presentationOrder.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Loading voting options...</h1>
          <p className="text-muted-foreground">Please wait while the host prepares voting</p>
        </div>
      </div>
    );
  }


  // Filter presentation order to show only tied images during revote
  const displayOrder = tiedImageIds && tiedImageIds.length > 0
    ? presentationOrder.filter(id => tiedImageIds.includes(id))
    : presentationOrder;

  const getVotersForSubmission = (submissionId: string) => {
    const voterIds = votes
      .filter((v) => v.submission_id === submissionId)
      .map((v) => v.voter_id);
    return players
      .filter((p) => voterIds.includes(p.id))
      .map((p) => p.name);
  };

  const isOwnSubmission = (submissionId: string) => {
    const submission = submissions.find(s => s.id === submissionId);
    return submission?.player_id === currentPlayerId;
  };

  const isRevoting = tiedImageIds && tiedImageIds.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            {isRevoting ? "🔄 Tie-Breaker Vote!" : "Vote for the Best Image"}
          </h1>
          <p className="text-lg text-muted-foreground">
            {isRevoting 
              ? "These images are tied - vote again!" 
              : "Look at the screen and tap the number of your favorite!"
            }
          </p>
          <Badge variant="secondary" className="px-4 py-2 text-base">
            ⏱️ {timeLeft}s
          </Badge>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {displayOrder.map((submissionId, index) => {
            const imageNumber = index + 1;
            const isOwn = isOwnSubmission(submissionId);
            const isSelected = currentVote === submissionId;

            return (
              <TooltipProvider key={submissionId}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => !isOwn && onVote(submissionId)}
                      disabled={isOwn}
                      size="lg"
                      variant={isSelected ? "default" : "outline"}
                      className={`h-24 text-4xl font-bold transition-all ${
                        isSelected
                          ? "ring-4 ring-primary scale-110"
                          : "hover:scale-105"
                      }`}
                    >
                      {imageNumber}
                    </Button>
                  </TooltipTrigger>
                  {isOwn && (
                    <TooltipContent>
                      <p>This is your submission</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {currentVote && (
          <div className="text-center">
            <Badge variant="default" className="px-6 py-3 text-base">
              ✓ You voted for #{displayOrder.findIndex(id => id === currentVote) + 1}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
