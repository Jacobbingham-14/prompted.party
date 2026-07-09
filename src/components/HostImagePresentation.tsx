import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Submission {
  id: string;
  image_url: string;
  player_id: string;
}

interface HostImagePresentationProps {
  submissions: Submission[];
  currentIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onStartVoting: () => void;
  tiedImageIds?: string[];
}

export default function HostImagePresentation({
  submissions,
  currentIndex,
  onNext,
  onPrevious,
  onStartVoting,
  tiedImageIds = [],
}: HostImagePresentationProps) {
  const currentSubmission = submissions[currentIndex];
  const isRevoting = tiedImageIds && tiedImageIds.length > 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-center space-y-3">
          <p className="font-retro text-xl uppercase tracking-widest text-gal-teal">
            {isRevoting ? "Tie-breaker — a second viewing" : "Fresh from the studio"}
          </p>
          <h1 className="font-pixel text-xl md:text-3xl leading-relaxed">
            LOT <span className="text-gal-gold">{currentIndex + 1}</span> OF {submissions.length}
          </h1>
        </div>

        {currentSubmission && (
          <div className="flex flex-col items-center gap-6">
            {/* The lot, in its gilded frame */}
            <div key={currentSubmission.id} className="relative animate-px-hop-in">
              <div className="gilded-frame p-3 md:p-4">
                <img
                  src={currentSubmission.image_url}
                  alt={`Lot ${currentIndex + 1}`}
                  className="max-h-[56vh] max-w-full border-2 border-ink object-contain"
                />
              </div>
              <div className="mt-4 flex justify-center">
                <p className="plaque px-3 py-2 text-[8px] md:text-[9px] leading-relaxed text-center">
                  LOT {currentIndex + 1} — MIXED PIXELS ON CANVAS, 2026<br />ARTIST TO BE REVEALED
                </p>
              </div>
            </div>

            <p className="font-retro text-xl text-muted-foreground">
              Study it well. Bidding opens shortly<span className="animate-px-blink">_</span>
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button onClick={onPrevious} disabled={currentIndex === 0} size="lg" variant="outline">
                <ChevronLeft className="mr-1 h-5 w-5" />
                Prev lot
              </Button>
              <Button
                onClick={onNext}
                size="lg"
                variant="secondary"
                disabled={currentIndex === submissions.length - 1}
              >
                Next lot
                <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
              <Button onClick={onStartVoting} size="lg" className="h-14 min-w-[220px]">
                Open bidding
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
