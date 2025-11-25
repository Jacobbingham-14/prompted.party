import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageGenerator } from '@/components/ImageGenerator';
import { Sparkles } from 'lucide-react';

interface ImageSubmissionProps {
  onSubmit: (file: File) => void;
  playersSubmitted: number;
  totalPlayers: number;
  prompt: string;
  roomId: string;
}

export default function ImageSubmission({ onSubmit, playersSubmitted, totalPlayers, prompt, roomId }: ImageSubmissionProps) {
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
        <div className="w-full max-w-2xl text-center space-y-6">
          <h1 className="text-4xl font-bold text-foreground">Submitted!</h1>
          <p className="text-2xl text-muted-foreground">
            Waiting for judging to begin...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Your Prompt</DialogTitle>
          </DialogHeader>
          <div className="border-4 border-primary rounded-lg p-8 bg-primary/10">
            <div className="flex items-start gap-4">
              <Sparkles className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
              <p className="text-xl text-foreground leading-relaxed">{prompt}</p>
            </div>
          </div>
          <Button onClick={() => setShowPromptDialog(false)} className="w-full h-12 text-lg">
            Got it!
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
          />
        </div>
      ) : (
        <div className="w-full max-w-2xl space-y-6">
          <h1 className="text-4xl font-bold text-center text-foreground">Review & Submit</h1>
          
          <div className="border-4 border-primary/50 rounded-lg p-6 bg-primary/5">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <p className="text-sm font-semibold text-primary mb-1">Your Prompt:</p>
                <p className="text-base text-foreground">{prompt}</p>
              </div>
            </div>
          </div>
          
          <div className="border-2 border-border rounded-lg p-6 bg-card space-y-4">
            <div className="border-2 border-border rounded-lg overflow-hidden bg-muted">
              <img src={preview} alt="Preview" className="w-full h-auto object-contain" />
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full h-12 text-lg"
            >
              Submit Image
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
