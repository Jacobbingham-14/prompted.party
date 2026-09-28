import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageGenerator } from '@/components/ImageGenerator';

interface ImageSubmissionProps {
  onSubmit: (imageUrl: string) => void;
  playersSubmitted: number;
  totalPlayers: number;
  prompt: string;
  roomId: string;
  hostId?: string;
}

export default function ImageSubmission({ onSubmit, playersSubmitted, totalPlayers, prompt, roomId, hostId }: ImageSubmissionProps) {
  const [submitted, setSubmitted] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(true);

  const handleGeneratorImage = (imageUrl: string) => {
    onSubmit(imageUrl);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <span className="plaque inline-flex h-20 w-20 items-center justify-center text-3xl animate-px-bounce">✓</span>
          <h1 className="font-pixel text-xl md:text-2xl leading-relaxed">
            MASTERPIECE<br /><span className="text-gal-gold">DELIVERED</span>
          </h1>
          <div className="exhibit-card p-5">
            <p className="font-retro text-xl">
              The curator has received your work.
              Eyes on the big screen<span className="animate-px-blink">_</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
        <DialogContent className="max-w-2xl rounded-none exhibit-card">
          <DialogHeader>
            <DialogTitle className="font-pixel text-center text-base md:text-lg leading-relaxed">
              YOUR <span className="text-gal-gold">COMMISSION</span>
            </DialogTitle>
          </DialogHeader>
          <div className="border-[3px] border-ink bg-paper p-6">
            <p className="font-pixel mb-3 text-[9px] text-gal-teal">THE GALLERY REQUESTS:</p>
            <p className="font-retro text-2xl leading-snug">
              {prompt}<span className="animate-px-blink">_</span>
            </p>
          </div>
          <Button onClick={() => setShowPromptDialog(false)} className="h-14 w-full">
            Accept the commission
          </Button>
        </DialogContent>
      </Dialog>

      <div className="w-full h-full">
        <ImageGenerator
          onImageReady={handleGeneratorImage}
          onClose={() => {}}
          prompt={prompt}
          roomId={roomId}
          hostId={hostId}
        />
      </div>
    </div>
  );
}
