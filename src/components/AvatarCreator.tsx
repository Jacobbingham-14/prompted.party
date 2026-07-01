import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Sparkles, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AVATAR_STYLES, AVATAR_PROMPT_PREFIX } from '@/lib/avatars';
import { isTrustedImageUrl } from '@/lib/imageUrl';

interface AvatarCreatorProps {
  playerId: string;
  roomId: string;
  onAvatarSaved: (url: string) => void;
}

export function AvatarCreator({ playerId, roomId, onAvatarSaved }: AvatarCreatorProps) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const getPrompt = () => {
    const base = customInput.trim() || selectedStyle || '';
    return base ? `${AVATAR_PROMPT_PREFIX}${base}` : '';
  };

  const handleGenerate = async () => {
    const prompt = getPrompt();
    if (!prompt) {
      toast({ title: 'Pick a style or describe your avatar', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setPreviewUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt, roomId },
      });

      if (error) throw new Error(error.message);

      const url = Array.isArray((data as any).output)
        ? (data as any).output[0]
        : (data as any).output;

      if (!isTrustedImageUrl(url)) {
        toast({ title: 'Generation failed', description: 'Received an untrusted image URL. Please try again.', variant: 'destructive' });
        return;
      }

      setPreviewUrl(url);
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseAvatar = async () => {
    if (!previewUrl) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('update_player_avatar', {
        p_player_id: playerId,
        p_avatar_url: previewUrl,
      });
      if (error) throw error;
      onAvatarSaved(previewUrl);
      setOpen(false);
      toast({ title: 'Avatar saved!' });
    } catch (err: any) {
      toast({ title: 'Failed to save avatar', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStyleClick = (stylePrompt: string) => {
    setSelectedStyle(stylePrompt);
    setCustomInput('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <User className="w-3.5 h-3.5" />
          Create Avatar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Your Avatar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Style presets */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Quick styles</p>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_STYLES.map((style) => (
                <button
                  key={style.label}
                  onClick={() => handleStyleClick(style.prompt)}
                  className={`text-xs px-2 py-1.5 rounded-md border transition-colors ${
                    selectedStyle === style.prompt
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom input */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Or describe it</p>
            <Input
              placeholder="e.g. a wizard with a glowing staff..."
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value);
                setSelectedStyle(null);
              }}
            />
          </div>

          {/* Preview */}
          <div className="aspect-square w-full rounded-lg overflow-hidden bg-muted flex items-center justify-center">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">Generating...</span>
              </div>
            ) : previewUrl ? (
              <img src={previewUrl} alt="Avatar preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Sparkles className="w-8 h-8" />
                <span className="text-sm">Your avatar will appear here</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || isSaving || (!selectedStyle && !customInput.trim())}
              variant="outline"
              className="flex-1"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {previewUrl ? 'Regenerate' : 'Generate'}
            </Button>
            <Button
              onClick={handleUseAvatar}
              disabled={!previewUrl || isSaving || isGenerating}
              className="flex-1"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Use this avatar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
