import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

interface HostImageVotingProps {
  submissions: Submission[];
  votes: ImageVote[];
  players: Player[];
  onSkip: () => void;
  presentationOrder: string[];
  tiedImageIds?: string[];
}

export default function HostImageVoting({
  submissions,
  votes,
  players,
  onSkip,
  presentationOrder,
  tiedImageIds = [],
}: HostImageVotingProps) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setShowSkip(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getVotersForSubmission = (submissionId: string) => {
    const voterIds = votes
      .filter((v) => v.submission_id === submissionId)
      .map((v) => v.voter_id);
    return players
      .filter((p) => voterIds.includes(p.id))
      .map((p) => p.name);
  };

  // Filter presentation order to show only tied images during revote
  const displayOrder = tiedImageIds && tiedImageIds.length > 0
    ? presentationOrder.filter(id => tiedImageIds.includes(id))
    : presentationOrder;

  // Use presentation order to display images in same order as players see them
  const orderedSubmissions = displayOrder
    .map(id => submissions.find(s => s.id === id))
    .filter((s): s is Submission => s !== undefined);

  const isRevoting = tiedImageIds && tiedImageIds.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            {isRevoting ? "🔄 Host View: Tie-Breaker Vote" : "Host View: Image Voting"}
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {orderedSubmissions.map((submission, index) => {
            const voters = getVotersForSubmission(submission.id);
            return (
              <Card key={submission.id} className="p-4 relative">
                <div className="relative">
                  <img
                    src={submission.image_url}
                    alt="Submission"
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  {/* Number badge - top left */}
                  <Badge
                    className="absolute top-2 left-2 h-12 w-12 rounded-full flex items-center justify-center text-2xl font-bold bg-primary text-primary-foreground"
                  >
                    {index + 1}
                  </Badge>
                  {/* Vote count badge - top right */}
                  {voters.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute top-2 right-2"
                    >
                      {voters.length} votes
                    </Badge>
                  )}
                </div>
                {voters.length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {voters.join(", ")}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="flex justify-center gap-4">
          {showSkip && (
            <Button onClick={onSkip} size="lg" variant="outline">
              Skip Voting (End Early)
            </Button>
          )}
          <Button onClick={onSkip} size="lg" disabled={votes.length === 0}>
            Complete Voting
          </Button>
        </div>
      </div>
    </div>
  );
}
