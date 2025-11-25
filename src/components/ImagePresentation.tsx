import { Card } from "@/components/ui/card";

interface ImagePresentationProps {
  roundNumber: number;
  tiedImageIds?: string[];
}

export default function ImagePresentation({ roundNumber, tiedImageIds = [] }: ImagePresentationProps) {
  const isRevoting = tiedImageIds && tiedImageIds.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="p-12 text-center space-y-6 max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground">
          {isRevoting ? "🔄 Tie-Breaker Round" : `Round ${roundNumber}`}
        </h1>
        <div className="text-2xl text-muted-foreground">
          Waiting for host to start voting...
        </div>
        <p className="text-lg text-muted-foreground">
          {isRevoting 
            ? "The tied images will be presented again. Get ready to break the tie!" 
            : "The host is presenting all submitted images. Get ready to vote for your favorite!"
          }
        </p>
      </Card>
    </div>
  );
}
