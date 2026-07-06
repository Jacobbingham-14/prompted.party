import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RoundStartProps {
  roundNumber: number;
  judgeName: string;
  isJudge: boolean;
  roomId: string;
  roundId: string;
  onContinue: (selectedPrompt: string) => void;
}

interface Prompt {
  id: string;
  text: string;
}

export default function RoundStart({ roundNumber, judgeName, isJudge, roomId, roundId, onContinue }: RoundStartProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [selectedPromptText, setSelectedPromptText] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (isJudge && roomId) {
      fetchRandomPrompts();
      
      // Setup broadcast channel for judge
      channelRef.current = supabase.channel(`room-${roomId}-judge-selection`);
      channelRef.current.subscribe();
    }
    
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [isJudge, roomId]);

  const fetchRandomPrompts = async () => {
    setIsLoading(true);
    
    // Fetch all previous rounds for this room to get used prompts
    const { data: previousRounds, error: roundsError } = await supabase
      .from('rounds')
      .select('prompt')
      .eq('room_id', roomId)
      .not('prompt', 'is', null);
    
    if (roundsError) {
      console.error('Error fetching previous rounds:', roundsError);
    }
    
    // Extract used prompt texts
    const usedPrompts = new Set(
      previousRounds?.map(round => round.prompt?.trim()) || []
    );
    
    // Fetch all available prompts (Judge mode's own pool)
    const { data, error } = await supabase
      .from('judge_prompts')
      .select('*')
      .eq('archived', false)
      .limit(100);

    if (error) {
      console.error('Error fetching prompts:', error);
      setIsLoading(false);
      return;
    }

    // Filter out already-used prompts
    const unusedPrompts = data?.filter(
      prompt => !usedPrompts.has(prompt.text.trim())
    ) || [];
    
    // If we have fewer than 4 unused prompts, allow repeats
    const promptsToUse = unusedPrompts.length >= 4 ? unusedPrompts : data || [];
    
    // Shuffle and take 4 random prompts
    const shuffled = promptsToUse.sort(() => 0.5 - Math.random());
    setPrompts(shuffled.slice(0, 4));
    setIsLoading(false);
  };

  const handleSelectPrompt = (promptId: string, promptText: string) => {
    setSelectedPromptId(promptId);
    setSelectedPromptText(promptText);

    // Judge broadcasts their selection to the host
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'prompt-selected',
        payload: { prompt: promptText }
      });
    }

    onContinue(promptText);
  };

  const handleSelectCustom = async () => {
    const trimmed = customPrompt.trim();
    if (trimmed && trimmed.length <= 200) {
      setSelectedPromptText(trimmed);

      // Save custom prompt to database for admin review (background operation)
      try {
        await supabase.from('custom_prompts').insert({
          text: trimmed,
          round_id: roundId,
          room_id: roomId,
          judge_name: judgeName
        });
      } catch (error) {
        console.error('Failed to save custom prompt:', error);
      }

      // Judge broadcasts their selection to the host
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'prompt-selected',
          payload: { prompt: trimmed }
        });
      }

      onContinue(trimmed);
    }
  };

  if (!isJudge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-8 text-center">
          <h1 className="text-5xl font-bold text-foreground">Round {roundNumber}</h1>
          
          <div className="border-4 border-border rounded-lg p-12 bg-card">
            <div className="flex justify-center mb-6">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
            <p className="text-2xl mb-4 text-card-foreground">
              Judge: {judgeName}
            </p>
            <p className="text-xl text-muted-foreground">
              Judge is selecting the prompt...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show confirmation screen after judge selects a prompt
  if (selectedPromptText) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <h1 className="text-5xl font-bold text-foreground">Round {roundNumber}</h1>
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <div className="space-y-2">
            <p className="text-2xl font-semibold text-foreground">Prompt selected!</p>
            <div className="rounded-xl border-2 border-green-500 bg-green-500/10 p-4 mt-4">
              <p className="text-lg font-medium text-foreground">{selectedPromptText}</p>
            </div>
          </div>
          <p className="text-muted-foreground">Waiting for players to start submitting…</p>
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold text-foreground">Round {roundNumber}</h1>
          <p className="text-2xl text-muted-foreground">You're the Judge! Select a prompt:</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prompts.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => handleSelectPrompt(prompt.id, prompt.text)}
                className="group border-4 border-border rounded-lg p-6 bg-card hover:bg-accent hover:border-primary transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <Sparkles className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                  <p className="text-lg text-card-foreground group-hover:text-accent-foreground">
                    {prompt.text}
                  </p>
                </div>
              </button>
            ))}

            <div className="border-4 border-dashed border-border rounded-lg p-6 bg-card/50 space-y-4 md:col-span-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-muted-foreground" />
                <p className="text-lg font-semibold text-card-foreground">Or write your own prompt:</p>
              </div>
              <div className="space-y-2">
                <Textarea
                  value={customPrompt}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 200) {
                      setCustomPrompt(value);
                    }
                  }}
                  placeholder="Enter your custom prompt here..."
                  className="min-h-[120px] resize-none text-base"
                  maxLength={200}
                />
                <div className="flex justify-end">
                  <p className={`text-sm ${customPrompt.length > 180 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {customPrompt.length}/200 characters
                  </p>
                </div>
              </div>
              <Button
                onClick={handleSelectCustom}
                disabled={!customPrompt.trim() || customPrompt.length > 200}
                className="w-full h-12 text-lg"
              >
                Use Custom Prompt
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
