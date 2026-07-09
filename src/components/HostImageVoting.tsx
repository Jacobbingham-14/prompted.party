import { Button } from "@/components/ui/button";
import { useSharedDeadline } from "@/hooks/useSharedDeadline";

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
  deadlineAt?: string | null;
}

export default function HostImageVoting({
  submissions,
  votes,
  players,
  onSkip,
  presentationOrder,
  tiedImageIds = [],
  deadlineAt,
}: HostImageVotingProps) {
  const { timeLeft, expired } = useSharedDeadline(deadlineAt, 30);
  const showSkip = expired;

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
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="text-center space-y-4">
          <p className="font-retro text-xl uppercase tracking-widest text-gal-teal">
            {isRevoting ? "Tie-breaker — the gavel hovers" : "Paddles up, grab your phone"}
          </p>
          <h1 className="font-pixel text-2xl md:text-4xl leading-relaxed">
            BIDDING IS <span className="text-gal-seal">OPEN</span>
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span className="plaque px-4 py-2.5 text-[10px] md:text-xs">
              TIME {String(timeLeft).padStart(2, "0")}
            </span>
            <span className="plaque px-4 py-2.5 text-[10px] md:text-xs">
              BIDS {votes.length}/{players.length}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 md:gap-8">
          {orderedSubmissions.map((submission, index) => {
            const voters = getVotersForSubmission(submission.id);
            return (
              <figure
                key={submission.id}
                className="relative animate-px-hop-in space-y-2"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <figcaption className="font-retro text-center text-lg">
                  Lot {index + 1}
                </figcaption>
                <div className="gilded-frame p-2">
                  <img
                    src={submission.image_url}
                    alt={`Lot ${index + 1}`}
                    className="aspect-square w-full border-2 border-ink object-cover"
                  />
                </div>
                <span className="plaque absolute -left-2 top-6 flex h-11 w-11 items-center justify-center text-base">
                  {index + 1}
                </span>
                {voters.length > 0 && (
                  <span className="absolute -right-2 top-6 border-2 border-ink bg-gal-seal px-2.5 py-1.5 font-pixel text-[9px] text-paper">
                    {voters.length} BID{voters.length === 1 ? "" : "S"}
                  </span>
                )}
                {voters.length > 0 && (
                  <p className="font-retro truncate text-center text-base text-muted-foreground">
                    {voters.join(", ")}
                  </p>
                )}
              </figure>
            );
          })}
        </div>

        <div className="flex justify-center gap-4">
          {showSkip && (
            <Button onClick={onSkip} size="lg" variant="outline">
              Close bidding early
            </Button>
          )}
          <Button onClick={onSkip} size="lg" disabled={votes.length === 0} className="h-14 px-10">
            Bring down the gavel
          </Button>
        </div>
      </div>
    </div>
  );
}
