import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Send,
  RotateCw,
  Images,
  Palette,
  Sun,
  Contrast,
  Zap,
  Pencil,
  Download,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useGenerationLimit } from "@/hooks/useGenerationLimit";

interface GeneratedImage {
  url: string;
  prompt: string;
  seed?: number;
  timestamp: number;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  seed?: number;
  isPromptRefinement?: boolean;
  fullPrompt?: string;
}

interface ImageGeneratorProps {
  onImageReady: (file: File, metadata: { imageUrl: string; prompt: string; seed?: number }) => Promise<void> | void;
  onClose?: () => void;
  prompt?: string;
  roomId?: string;
  hostId?: string;
}

export const ImageGenerator = ({ onImageReady, onClose, prompt: initialPrompt, roomId, hostId }: ImageGeneratorProps) => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [currentSeed, setCurrentSeed] = useState<number | undefined>(undefined);
  const [imageHistory, setImageHistory] = useState<GeneratedImage[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { allowed, decrementLocally } = useGenerationLimit(hostId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
    }
  }, [prompt]);


  const generateImage = async (finalPrompt: string) => {
    if (!allowed && hostId) {
      toast({
        title: "Generation limit reached",
        description: "Ask your host to top up image credits to keep generating.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Always use a fresh random seed. There's no image-to-image conditioning
      // here (Replicate only ever gets a text prompt, no reference image), so
      // reusing a seed across generations doesn't produce "the same shot with
      // a small tweak" -- it just constrains flux-schnell's diffusion noise,
      // which collapses subsequent generations toward a near-identical
      // composition regardless of prompt changes. That's why every image after
      // a player's first one used to look the same.
      const seedToUse: number | undefined = undefined;

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: finalPrompt,
          seed: seedToUse,
          roomId: roomId,
        },
      });

      if (error) {
        // Handle 429 limit exceeded from edge function
        if (error.message?.includes('429') || (data as any)?.remaining === 0) {
          toast({
            title: "Generation limit reached",
            description: "Ask your host to top up image credits to keep generating.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(error.message || "Failed to generate image");
      }

      decrementLocally();

      const imageUrl = Array.isArray((data as any).output) ? (data as any).output[0] : (data as any).output;

      const newSeed = seedToUse ?? Math.floor(Math.random() * 1000000);
      setCurrentSeed(newSeed);

      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          imageUrl,
          seed: newSeed,
          fullPrompt: finalPrompt,
        },
      ]);

      setImageHistory((prev) => [
        ...prev,
        {
          url: imageUrl,
          prompt: finalPrompt,
          seed: newSeed,
          timestamp: Date.now(),
        },
      ]);

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error?.message || "Sorry, I couldn't generate that image. Please try again.",
          isPromptRefinement: true,
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const convertImageToFile = async (imageUrl: string, promptText: string, seed?: number) => {
    setIsPreparingImage(true);
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error("Unable to download generated image");
      }

      const blob = await response.blob();
      const extension = blob.type.split("/")[1] ?? "webp";
      const file = new File([blob], `ai-image-${Date.now()}.${extension}`, { type: blob.type || "image/webp" });

      await onImageReady(file, { imageUrl, prompt: promptText, seed });
      toast({
        title: "Submitted!",
        description: "Your AI-generated image has been submitted successfully.",
      });
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error("Failed to prepare image:", error);
      toast({
        title: "Couldn't use image",
        description: error instanceof Error ? error.message : "Unknown error occurred while preparing the image.",
        variant: "destructive",
      });
    } finally {
      setIsPreparingImage(false);
    }
  };

  const handleSend = async () => {
    if (!prompt.trim() || isGenerating) return;

    const userMessage = prompt.trim();
    setConversation((prev) => [...prev, { role: "user", content: userMessage }]);
    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    generateImage(userMessage);
  };

  const handleStartOver = () => {
    setConversation([]);
    setCurrentSeed(undefined);
    setPrompt("");
  };

  const handleDownloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `flux-image-${index}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({
        title: "Downloaded!",
        description: "Image saved to your device",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the image",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleEditPrompt = (promptText: string) => {
    setPrompt(promptText);
    textareaRef.current?.focus();
  };

  const renderUseImageButton = (msg: ConversationMessage) => {
    if (!msg.imageUrl || !msg.fullPrompt) {
      return null;
    }

    return (
      <Button
        size="sm"
        onClick={() => convertImageToFile(msg.imageUrl!, msg.fullPrompt!, msg.seed)}
        disabled={isPreparingImage}
        className="rounded-full text-xs"
      >
        {isPreparingImage ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Check className="w-3 h-3 mr-2" />}
        Submit
      </Button>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
            AI
          </div>
          <h1 className="font-semibold text-foreground">AI Image Studio</h1>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Images className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Generated Images</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                {imageHistory.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-muted-foreground">No images generated yet</div>
                ) : (
                  imageHistory
                    .slice()
                    .reverse()
                    .map((img, idx) => (
                      <div
                        key={idx}
                        className="group relative aspect-square rounded-lg overflow-hidden bg-secondary"
                      >
                        <img
                          src={img.url}
                          alt={`Generated ${idx}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
                            <p className="text-xs text-foreground/80 line-clamp-2">{img.prompt}</p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1"
                                onClick={() => convertImageToFile(img.url, img.prompt, img.seed)}
                                disabled={isPreparingImage}
                              >
                                {isPreparingImage ? (
                                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3 mr-2" />
                                )}
                                Use
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadImage(img.url, imageHistory.length - idx - 1)}
                              >
                                <Download className="w-3 h-3 mr-2" />
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </DialogContent>
          </Dialog>
          {conversation.length > 0 && (
            <Button
              onClick={handleStartOver}
              variant="ghost"
              size="sm"
              disabled={isGenerating || isPreparingImage}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
        {conversation.length === 0 ? (
          <div className="flex flex-col items-center justify-start pt-12 min-h-full text-center space-y-4 px-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-4xl">✨</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Start Creating</h3>
              {initialPrompt ? (
                <div className="max-w-xl mx-auto">
                  <p className="text-lg text-muted-foreground mb-3">Your assigned prompt:</p>
            <div className="border-2 border-primary/50 rounded-lg p-6 bg-primary/5">
              <p className="text-xl text-foreground font-semibold">{initialPrompt}</p>
                  </div>
                  <p className="text-lg text-muted-foreground mt-3">
                    Type in the box below to start generating your image based on this prompt.
                  </p>
                </div>
              ) : (
                <p className="text-lg text-muted-foreground max-w-md">
                  Describe the scene you imagine — The more specific the prompt, the better the result.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {conversation.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[70%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-[20px] rounded-br-sm"
                      : "bg-secondary text-secondary-foreground rounded-[20px] rounded-bl-sm"
                  } px-4 py-3 shadow-sm`}
                >
                  {msg.content && (
                    <p className="text-xl leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                  {msg.imageUrl && (
                    <div className={msg.content ? "mt-2" : ""}>
                      <img src={msg.imageUrl} alt="Generated" className="rounded-lg w-full max-w-md shadow-md" />
                      {idx === conversation.length - 1 && !isGenerating && msg.fullPrompt && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateImage(msg.fullPrompt!)}
                            className="rounded-full text-xs"
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            Remix Style
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditPrompt(msg.fullPrompt!)}
                            className="rounded-full text-xs"
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            Edit Prompt
                          </Button>
                          {renderUseImageButton(msg)}
                        </div>
                      )}
                      {idx !== conversation.length - 1 && (
                        <div className="mt-3 flex flex-wrap gap-2">{renderUseImageButton(msg)}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-secondary text-secondary-foreground rounded-[20px] rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Generating image...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="border-t bg-card p-4 shrink-0 sticky bottom-0 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              placeholder="Describe what you want to create..."
              value={prompt}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyPress}
              className="min-h-[60px] max-h-[240px] resize-none rounded-[22px] border-border bg-background px-4 py-3 text-lg leading-relaxed overflow-y-auto"
              disabled={isGenerating}
              rows={2}
            />
            <Button
              onClick={handleSend}
              disabled={isGenerating || !prompt.trim() || !allowed}
              size="icon"
              className="h-[44px] w-[44px] rounded-full shrink-0"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;
