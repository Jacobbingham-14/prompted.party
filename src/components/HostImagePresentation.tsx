import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            {isRevoting ? "🔄 Tie-Breaker Presentation" : "Image Presentation"}
          </h1>
          <Badge variant="secondary" className="px-4 py-2 text-lg">
            {currentIndex + 1} of {submissions.length}
          </Badge>
        </div>

        {currentSubmission && (
          <Card className="p-8">
            <div className="flex flex-col items-center gap-6">
              <img
                src={currentSubmission.image_url}
                alt="Submission"
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
              
              <div className="space-y-4 w-full">
                {/* Navigation Controls */}
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={onPrevious}
                    disabled={currentIndex === 0}
                    size="lg"
                    variant="outline"
                  >
                    <ChevronLeft className="w-5 h-5 mr-2" />
                    Previous
                  </Button>
                  
                  <Button 
                    onClick={onNext} 
                    size="lg"
                    disabled={currentIndex === submissions.length - 1}
                  >
                    Next
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>

                {/* Start Voting Action - Always Visible */}
                <div className="flex justify-center pt-4 border-t">
                  <Button 
                    onClick={onStartVoting} 
                    size="lg"
                    className="min-w-[200px]"
                  >
                    Start Voting
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
