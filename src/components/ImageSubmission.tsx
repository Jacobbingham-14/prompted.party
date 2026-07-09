import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageGenerator } from '@/components/ImageGenerator';

interface ImageSubmissionProps {
  onSubmit: (file: File) => void;
  playersSubmitted: number;
  totalPlayers: number;
  prompt: string;
  roomId: string;
  hostId?: string;
}

export default function ImageSubmission({ onSubmit, playersSubmitted, totalPlayers, prompt, roomId, hostId }: ImageSubmissionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(true);

  const handleGeneratorImage = async (file: File, metadata: { prompt: string; seed?: number }) => {
    // Clean up any existing preview
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    // Immediately submit without showing review screen
    onSubmit(file);
    setSubmitted(true);
  };

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleSubmit = () => {
    if (selectedFile) {
      onSubmit(selectedFile);
      setSubmitted(true);
    }
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

      {!selectedFile ? (
        <div className="w-full h-full">
          <ImageGenerator
            onImageReady={async (file, metadata) => {
              await handleGeneratorImage(file, metadata);
            }}
            onClose={() => {}}
            prompt={prompt}
            roomId={roomId}
            hostId={hostId}
          />
        </div>
      ) : (
        <div className="w-full max-w-2xl space-y-6">
          <h1 className="font-pixel text-center text-xl leading-relaxed">READY TO HANG?</h1>

          <div className="exhibit-card p-5">
            <p className="font-pixel mb-2 text-[9px] text-gal-teal">YOUR COMMISSION:</p>
            <p className="font-retro text-xl">{prompt}</p>
          </div>

          <div className="gilded-frame p-3">
            <img src={preview ?? undefined} alt="Preview" className="w-full border-2 border-ink object-contain" />
            <div className="mt-3 flex justify-center">
              <p className="plaque px-3 py-1.5 text-[8px]">UNTITLED — YOU, 2026</p>
            </div>
          </div>

          <Button onClick={handleSubmit} className="h-14 w-full">
            Submit to the gallery
          </Button>
        </div>
      )}
    </div>
  );
}
