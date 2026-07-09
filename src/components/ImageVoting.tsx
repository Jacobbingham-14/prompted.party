import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

interface ImageVotingProps {
  submissions: Submission[];
  currentVote: string | null;
  votes: ImageVote[];
  players: Player[];
  currentPlayerId: string;
  onVote: (submissionId: string) => void;
  presentationOrder: string[];
  tiedImageIds?: string[];
  deadlineAt?: string | null;
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
  deadlineAt,
}: ImageVotingProps) {
  const { timeLeft } = useSharedDeadline(deadlineAt, 30);

  // Show loading state if no presentation order
  if (!presentationOrder || presentationOrder.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="font-pixel text-lg leading-relaxed">PREPARING THE AUCTION</h1>
          <p className="font-retro text-xl text-gal-teal">
            The curator is arranging the lots<span className="animate-px-blink">_</span>
          </p>
        </div>
      </div>
    );
  }

  // Filter presentation order to show only tied images during revote
  const displayOrder = tiedImageIds && tiedImageIds.length > 0
    ? presentationOrder.filter(id => tiedImageIds.includes(id))
    : presentationOrder;

  const isOwnSubmission = (submissionId: string) => {
    const submission = submissions.find(s => s.id === submissionId);
    return submission?.player_id === currentPlayerId;
  };

  const isRevoting = tiedImageIds && tiedImageIds.length > 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center space-y-3">
          <p className="font-retro text-lg uppercase tracking-widest text-gal-teal">
            {isRevoting ? "Tie-breaker — bid again" : "Eyes on the big screen"}
          </p>
          <h1 className="font-pixel text-xl leading-relaxed">
            CAST YOUR <span className="text-gal-seal">BID</span>
          </h1>
          <span className="plaque inline-flex px-4 py-2 text-[10px]">
            TIME {String(timeLeft).padStart(2, "0")}
          </span>
        </div>

        {/* Auction paddles — match the lot numbers on the big screen */}
        <div className="grid grid-cols-3 gap-4">
          {displayOrder.map((submissionId, index) => {
            const imageNumber = index + 1;
            const isOwn = isOwnSubmission(submissionId);
            const isSelected = currentVote === submissionId;

            return (
              <TooltipProvider key={submissionId}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => !isOwn && onVote(submissionId)}
                      disabled={isOwn}
                      className={`px-btn plaque aspect-square !text-2xl ${
                        isOwn
                          ? "opacity-30 saturate-0"
                          : isSelected
                            ? "ring-4 ring-gal-seal ring-offset-4 ring-offset-background"
                            : ""
                      }`}
                    >
                      {imageNumber}
                    </button>
                  </TooltipTrigger>
                  {isOwn && (
                    <TooltipContent>
                      <p className="font-retro text-lg">You cannot bid on your own masterpiece</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {currentVote ? (
          <p className="font-retro text-center text-xl text-gal-seal">
            ▸ Bid placed on Lot {displayOrder.findIndex(id => id === currentVote) + 1}. Tap another to change.
          </p>
        ) : (
          <p className="font-retro text-center text-xl text-muted-foreground">
            Tap the lot number of your favorite<span className="animate-px-blink">_</span>
          </p>
        )}
      </div>
    </div>
  );
}
