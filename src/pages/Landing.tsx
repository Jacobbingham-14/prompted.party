import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyErrorMessage, logErrorInDev } from "@/lib/errorUtils";
import {
  Sparkles,
  Users,
  Trophy,
  QrCode,
  Zap,
  Palette,
  PartyPopper,
  Briefcase,
  Coffee,
  GamepadIcon,
  ArrowRight,
  ChevronDown,
  Mail,
  Lock,
  Loader2,
} from "lucide-react";
import { validateSuggestionForm } from "@/lib/validation";
import { usePurchasedGameModes } from "@/hooks/usePurchasedGameModes";
import { startCheckout, type GameMode } from "@/lib/checkout";

interface Room {
  id: string;
  code: string;
  status: string;
  created_at: string;
  host_id: string;
}

const Landing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<'marketing' | 'active-games' | 'create' | 'join'>('marketing');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameMode, setGameMode] = useState<'judge' | 'voting' | 'forgery' | 'duel'>('judge');
  const [hostRooms, setHostRooms] = useState<Room[]>([]);
  const { owned: ownedModes, loading: ownedModesLoading, refetch: refetchOwnedModes } = usePurchasedGameModes(user?.id);
  const [purchasing, setPurchasing] = useState(false);

  const ALL_MODES: GameMode[] = ['judge', 'voting', 'forgery', 'duel'];
  const allModesOwned = ALL_MODES.every((m) => ownedModes.has(m));

  const buyModes = async (payload: Parameters<typeof startCheckout>[0]) => {
    if (!user) {
      toast({
        title: "Please log in first",
        description: "You need to be signed in to unlock and pay for a game mode.",
        variant: "destructive",
      });
      return;
    }
    setPurchasing(true);
    try {
      await startCheckout(payload);
    } catch (err) {
      toast({
        title: "Couldn't start checkout",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      setPurchasing(false);
    }
  };

  // If we just came back from a successful Stripe checkout, refresh ownership
  useEffect(() => {
    if (searchParams.get('purchase') === 'success') {
      refetchOwnedModes();
      toast({ title: "Purchase complete!", description: "Your unlock is ready." });
    }
  }, [searchParams]);
  const [suggestionDialogOpen, setSuggestionDialogOpen] = useState(false);
  const [suggestionForm, setSuggestionForm] = useState({ message: '' });
  const [isJoining, setIsJoining] = useState(false);
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

  // Handle QR code join
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      setRoomCode(codeFromUrl.toUpperCase());
      setMode('join');
    }
  }, [searchParams]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Determine initial mode based on URL params and login status
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'host' && user) {
      setMode('create');
      // Clean up the URL param so refresh doesn't force create mode
      navigate('/', { replace: true });
    } else if (urlMode === 'join') {
      setMode('join');
    } else if (user && hostRooms.length > 0) {
      setMode('active-games');
    } else {
      setMode('marketing');
    }
  }, [searchParams, user, hostRooms.length]);

  // Fetch active host rooms
  const fetchHostRooms = async (userId: string) => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false });

    if (data) {
      setHostRooms(data as Room[]);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setHostRooms([]);
    setMode('marketing');
  };

  const handleCreateRoom = async (selectedGameMode: 'judge' | 'voting' | 'forgery' | 'duel') => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data, error } = await supabase
        .from('rooms')
        .insert({
          code,
          host_id: user.id,
          user_id: user.id,
          status: 'waiting',
          game_mode: selectedGameMode
        })
        .select()
        .single();

      if (error) throw error;

      localStorage.setItem('hostRoomId', data.id);
      navigate(`/play?mode=host`);
    } catch (error) {
      logErrorInDev('Create room error', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error),
        variant: 'destructive'
      });
    }
  };

  const handleJoinRoom = async (name: string, code: string) => {
    if (!name.trim() || !code.trim()) return;
    if (isJoining) return;
    setIsJoining(true);

    try {
      const { data: roomRows } = await supabase.rpc('find_room_by_code', {
        room_code: code.toUpperCase()
      });
      const room = Array.isArray(roomRows) ? roomRows[0] : roomRows;

      if (!room) {
        toast({
          title: 'Error',
          description: 'Room not found',
          variant: 'destructive'
        });
        return;
      }

      if (room.status !== 'waiting' && room.status !== 'playing') {
        toast({
          title: 'Error',
          description: 'This room is no longer active',
          variant: 'destructive'
        });
        return;
      }

      const trimmedName = name.trim();

      // Reuse an existing player row with this (case-insensitive) name so
      // rejoining after a refresh lands the player back in their seat.
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', room.id)
        .ilike('name', trimmedName)
        .maybeSingle();

      let player = existingPlayer;

      if (!player) {
        const { data: created, error } = await supabase
          .from('players')
          .insert({
            room_id: room.id,
            name: trimmedName,
            score: 0
          })
          .select()
          .single();

        if (error) {
          if ((error as { code?: string }).code === '23505') {
            toast({
              title: 'Name taken',
              description: 'Someone in this room is already using that name. Try another.',
              variant: 'destructive',
            });
            return;
          }
          throw error;
        }
        player = created;
      }

      const codeUpper = code.toUpperCase();

      // Store session data using separate keys (matching Join.tsx standard)
      localStorage.setItem('playerId', player.id);
      localStorage.setItem('roomId', room.id);
      localStorage.setItem('roomCode', codeUpper);

      // Navigate to game with state to avoid race condition
      navigate('/play', {
        state: {
          playerId: player.id,
          roomId: room.id,
          roomCode: codeUpper
        }
      });
    } catch (error) {
      logErrorInDev('Join room error', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error),
        variant: 'destructive'
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleContinueRoom = (roomId: string) => {
    localStorage.setItem('hostRoomId', roomId);
    navigate('/play?mode=host');
  };

  const handleEndRoom = async (roomId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('delete_ended_room', {
        p_room_id: roomId,
        p_caller_id: user.id
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Room ended successfully'
      });

      fetchHostRooms(user.id);
    } catch (error) {
      logErrorInDev('End room error', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error),
        variant: 'destructive'
      });
    }
  };

  const handleSuggestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Double-check user is logged in
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to submit suggestions.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmittingSuggestion(true);

      // Validate form
      const validatedData = validateSuggestionForm(suggestionForm);

      // Insert with user_id automatically
      const { error } = await supabase
        .from('suggestions')
        .insert([{
          user_id: user.id,
          message: validatedData.message,
          status: 'new'
        }]);

      if (error) throw error;

      toast({
        title: "Suggestion sent!",
        description: "Thank you for your feedback. We'll review it shortly.",
      });

      // Reset form and close dialog
      setSuggestionForm({ message: '' });
      setSuggestionDialogOpen(false);

    } catch (error: any) {
      logErrorInDev('Submit suggestion error', error);
      toast({
        title: "Error",
        description: getUserFriendlyErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSubmittingSuggestion(false);
    }
  };

  const features = [
    {
      icon: Palette,
      title: "AI-Powered Creation",
      description: "Generate unique images using advanced AI technology",
    },
    {
      icon: Sparkles,
      title: "Prompt Enhancement",
      description: "Let AI help improve your creative prompts",
    },
    {
      icon: Trophy,
      title: "Competitive Scoring",
      description: "Earn points when your images get votes from other players or the rounds judge",
    },
    {
      icon: QrCode,
      title: "Easy to Join",
      description: "Simple room codes or QR codes for instant access",
    },
    {
      icon: Users,
      title: "Multiplayer Fun",
      description: "Play with 3 or more friends for maximum entertainment",
    },
    {
      icon: Zap,
      title: "Real-time Updates",
      description: "Everyone sees submissions and scores instantly",
    },
  ];

  const useCases = [
    { icon: PartyPopper, text: "Party games with friends" },
    { icon: Briefcase, text: "Team building activities" },
    { icon: Coffee, text: "Creative ice breakers" },
    { icon: GamepadIcon, text: "Game nights" },
  ];

  const faqs = [
    {
      question: "How many players can join?",
      answer: "You need at least 3 players to start a game. There's no strict maximum, but we recommend 4-10 players for the best experience.",
    },
    {
      question: "Do I need an account to play?",
      answer: "Players don't need an account—just join with your name and room code! However, hosts do need to create a free account to host games and manage prompts.",
    },
    {
      question: "How does the judging work?",
      answer: "Players take turns being the judge each round. The judge either selects a prompt from the game's prompt library or creates their own custom prompt. All other players then generate images based on that prompt. The judge reviews all submissions and picks their favorite—the creator of the winning image earns a point! The judge role rotates to a different player each round, so everyone gets a turn.",
    },
    {
      question: "What's the best setup for playing?",
      answer: "For the optimal experience, the host should use a laptop or connect to a TV/monitor so everyone can view the game together. Players join on their mobile phones to submit their images. This setup makes it perfect for parties and group gatherings where everyone can see the submissions on the big screen while using their phones to play.",
    },
    {
      question: "Can I play multiple rounds?",
      answer: "Yes! The host controls the game flow and can start as many rounds as you want. Scores carry over between rounds for continuous competition.",
    },
    {
      question: "What happens if someone disconnects?",
      answer: "The game continues with the remaining players. If the host disconnects, the game will end. Players can reconnect using the same room code if they disconnect accidentally.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header — gallery signage */}
      <header className="sticky top-0 z-50 w-full border-b-[3px] border-ink bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="plaque px-2 py-1.5 text-[10px]">▦</span>
            <span className="font-pixel text-sm">PROMPTED</span>

            {/* Suggestions Button */}
            <Dialog open={suggestionDialogOpen} onOpenChange={setSuggestionDialogOpen}>
              <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-2 text-muted-foreground hover:text-foreground">
                <Mail className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline">Suggestion box</span>
              </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-none exhibit-card">
                <DialogHeader>
                  <DialogTitle className="font-pixel text-sm leading-relaxed">LEAVE A NOTE FOR THE CURATOR</DialogTitle>
                </DialogHeader>

                {!user ? (
                  // Show login prompt if not authenticated
                  <div className="space-y-4 mt-4 text-center py-8">
                    <p className="font-retro text-xl text-muted-foreground">
                      Please log in to submit suggestions and prompt ideas.
                    </p>
                    <Button onClick={() => {
                      setSuggestionDialogOpen(false);
                      navigate('/auth');
                    }}>
                      Log in to submit
                    </Button>
                  </div>
                ) : (
                  // Show form if authenticated
                  <form onSubmit={handleSuggestionSubmit} className="space-y-4 mt-4">
                    <div className="font-retro text-lg text-muted-foreground">
                      Submitting as: <span className="text-foreground">{user.email}</span>
                    </div>

                    <div>
                      <Label htmlFor="suggestion-message" className="font-pixel text-[10px]">YOUR SUGGESTION OR PROMPT IDEA</Label>
                      <Textarea
                        id="suggestion-message"
                        placeholder="Share your ideas for new prompts or suggestions to improve the game..."
                        value={suggestionForm.message}
                        onChange={(e) => setSuggestionForm({ ...suggestionForm, message: e.target.value })}
                        required
                        minLength={10}
                        maxLength={2000}
                        rows={8}
                        className="resize-none rounded-none border-[3px] border-ink font-retro text-lg mt-2"
                      />
                      <p className="font-retro text-base text-muted-foreground mt-1">
                        {suggestionForm.message.length}/2000 characters
                      </p>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSuggestionDialogOpen(false)}
                        disabled={isSubmittingSuggestion}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmittingSuggestion}>
                        {isSubmittingSuggestion ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-1 font-retro text-lg normal-case">
                    {user.email}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover rounded-none border-[3px] border-ink">
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer font-retro text-lg">
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" onClick={() => navigate("/auth")}>
                Login
              </Button>
            )}
            {mode === 'marketing' && (
              <Button onClick={() => user ? setMode('create') : navigate('/auth?next=host')}>
                Get Started <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            )}
            {mode !== 'marketing' && (
              <Button variant="outline" onClick={() => setMode('marketing')}>
                Back to Home
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Active Games Management */}
      {mode === 'active-games' && user && hostRooms.length > 0 && (
        <section className="container py-24">
          <div className="max-w-md mx-auto space-y-4">
            <h1 className="font-pixel text-xl text-center mb-4 leading-relaxed">YOUR ACTIVE EXHIBITIONS</h1>

            <div className="space-y-3">
              {hostRooms.map(room => (
                <Card key={room.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-pixel text-base">{room.code}</p>
                        <p className="font-retro text-lg text-muted-foreground capitalize">
                          {room.status}
                        </p>
                        <p className="font-retro text-base text-muted-foreground">
                          {new Date(room.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleContinueRoom(room.id)}
                          size="sm"
                        >
                          Continue
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleEndRoom(room.id)}
                        >
                          End
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              onClick={() => user ? setMode('create') : navigate('/auth?next=host')}
              className="w-full"
              variant="default"
            >
              Create New Game
            </Button>

            <Button
              onClick={() => setMode('join')}
              className="w-full"
              variant="secondary"
            >
              Join Game
            </Button>

            <Button
              onClick={() => setMode('marketing')}
              variant="outline"
              className="w-full"
            >
              Back to Home
            </Button>
          </div>
        </section>
      )}

      {/* Create Game Mode Selection */}
      {mode === 'create' && (
        <section className="container py-24">
          <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="font-pixel text-2xl text-center mb-2 leading-relaxed">SELECT GAME MODE</h1>
            <p className="font-retro text-center text-xl text-muted-foreground mb-6">
              {allModesOwned
                ? 'All game modes unlocked'
                : 'One-time $19.99 unlock gets all 4 game modes + 1000 image generations'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {([
                {
                  id: 'judge' as GameMode,
                  title: 'Judge Mode',
                  desc: 'One player judges and selects the winning image each round. Classic gameplay!',
                  bullets: ['Rotating judge each round', 'Judge picks the winner', 'Requires 3+ players'],
                  badge: null,
                },
                {
                  id: 'voting' as GameMode,
                  title: 'Voting Mode',
                  desc: 'All players vote for prompts and images. More democratic and engaging!',
                  bullets: ['Everyone votes on prompts', 'Everyone votes on images', 'Requires 3+ players'],
                  badge: null,
                },
                {
                  id: 'forgery' as GameMode,
                  title: 'Forgery Mode',
                  desc: 'Secret agents receive different prompts. Can you spot the forger?',
                  bullets: ['Secret prompt assignments', 'Vote to identify the forger', 'Requires 3+ players'],
                  badge: null,
                },
                {
                  id: 'duel' as GameMode,
                  title: 'Prompt Duel',
                  desc: 'Head-to-head matchups. Write the funnier answer, then everyone votes!',
                  bullets: ['Two prompts per player each round', 'One matchup revealed at a time', '3 rounds, rising stakes · 3+ players'],
                  badge: null,
                },
              ]).map((m) => {
                const isSelected = gameMode === m.id;
                return (
                  <Card
                    key={m.id}
                    onClick={() => setGameMode(m.id)}
                    className={`p-8 cursor-pointer relative ${
                      isSelected ? 'ring-4 ring-primary bg-primary/10' : ''
                    }`}
                  >
                    <CardContent className="p-0 space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-pixel text-sm leading-relaxed">{m.title}</h3>
                        {m.badge && (
                          <Badge className="bg-primary text-primary-foreground">{m.badge}</Badge>
                        )}
                        {allModesOwned ? (
                          <Badge variant="secondary" className="ml-auto rounded-none">Owned</Badge>
                        ) : (
                          <Badge variant="outline" className="ml-auto gap-1 rounded-none border-ink">
                            <Lock className="w-3 h-3" />
                          </Badge>
                        )}
                      </div>
                      <p className="font-retro text-xl text-muted-foreground">{m.desc}</p>
                      <ul className="font-retro text-lg text-muted-foreground space-y-1">
                        {m.bullets.map((b) => <li key={b}>▸ {b}</li>)}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => setMode(user && hostRooms.length > 0 ? 'active-games' : 'marketing')}
                variant="outline"
                className="flex-1"
                disabled={purchasing}
              >
                Back
              </Button>

              {ownedModesLoading ? (
                <Button className="flex-1" size="lg" disabled>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking access...
                </Button>
              ) : allModesOwned ? (
                <Button
                  onClick={() => handleCreateRoom(gameMode)}
                  className="flex-1"
                  size="lg"
                >
                  Create {gameMode === 'judge' ? 'Judge' : gameMode === 'voting' ? 'Voting' : gameMode === 'forgery' ? 'Forgery' : 'Prompt Duel'} Game
                </Button>
              ) : (
                <Button
                  onClick={() => buyModes({ type: 'full_access' })}
                  className="flex-1"
                  size="lg"
                  disabled={purchasing}
                >
                  {purchasing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Unlock Everything – $19.99
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Join Game Form */}
      {mode === 'join' && (
        <section className="container py-24">
          <div className="max-w-md mx-auto space-y-4">
            <h1 className="font-pixel text-xl text-center mb-4 leading-relaxed">SIGN THE GUEST BOOK</h1>

            {/* Name Input - Always shown */}
            <Input
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={50}
              disabled={isJoining}
              className="h-12 rounded-none border-[3px] border-ink font-retro text-2xl"
              autoFocus
            />

            {/* Room Code - Conditional rendering based on URL parameter */}
            {searchParams.get('code') ? (
              // Code from QR - show as read-only badge
              <div className="p-4 exhibit-card text-center">
                <p className="font-retro text-lg text-muted-foreground mb-1">Joining exhibition:</p>
                <p className="font-pixel text-xl tracking-widest">{roomCode}</p>
              </div>
            ) : (
              // Manual join - show editable input
              <Input
                placeholder="Room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={12}
                disabled={isJoining}
                className="h-12 rounded-none border-[3px] border-ink font-retro text-2xl tracking-[0.3em] uppercase"
              />
            )}

            <Button
              onClick={() => handleJoinRoom(playerName, roomCode)}
              disabled={!playerName.trim() || !roomCode.trim() || isJoining}
              className="w-full h-12"
            >
              {isJoining ? 'Joining…' : 'Enter the gallery'}
            </Button>
            <Button
              onClick={() => setMode('marketing')}
              variant="outline"
              className="w-full"
            >
              Back
            </Button>
          </div>
        </section>
      )}

      {/* Hero Section */}
      {mode === 'marketing' && (
        <>
          <section className="container py-20 md:py-28">
            <div className="flex flex-col items-center text-center space-y-8">
              <span className="plaque animate-px-hop-in px-4 py-2 text-[10px] tracking-wider">
                EST. MMXXVI ★ ADMISSION FREE ★ TASTE OPTIONAL
              </span>

              <div className="space-y-4">
                <h1 className="font-pixel text-4xl md:text-6xl lg:text-7xl leading-tight">
                  PROMPTED
                </h1>
                <p className="font-pixel text-xs md:text-sm text-gal-velvet tracking-wide">
                  A PRESTIGIOUS GALLERY OF ABSOLUTE NONSENSE
                </p>
              </div>

              <p className="font-retro text-2xl md:text-3xl text-muted-foreground max-w-2xl leading-snug">
                You write the words. The machine paints its masterpiece.
                Your friends pretend to be critics. The party game where
                <span className="text-gal-velvet"> bad art wins big</span>.
              </p>

              {/* The centerpiece: a gilded frame awaiting a masterpiece */}
              <div className="gilded-frame animate-px-hop-in animation-delay-150 w-full max-w-md p-8 md:p-10">
                <div className="dither-canvas flex aspect-[4/3] items-center justify-center border-[3px] border-ink">
                  <p className="font-pixel bg-paper border-2 border-ink px-4 py-3 text-[10px] md:text-xs leading-relaxed">
                    YOUR MASTERPIECE<br />HERE<span className="animate-px-blink">_</span>
                  </p>
                </div>
                <div className="mt-4 flex justify-center">
                  <p className="plaque px-3 py-2 text-[8px] md:text-[9px] leading-relaxed text-center">
                    "UNTITLED No. 47" — THE MACHINE, 2026<br />MIXED PIXELS ON CANVAS
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={() => user ? setMode('create') : navigate('/auth?next=host')} className="h-14 px-8">
                  <Users className="mr-2 w-5 h-5" />
                  Host an exhibition
                </Button>
                <Button size="lg" variant="outline" onClick={() => setMode('join')} className="h-14 px-8">
                  <QrCode className="mr-2 w-5 h-5" />
                  Enter as an artist
                </Button>
              </div>
            </div>
          </section>

          <div className="velvet-rule container" role="separator" />

          {/* What Is This Game Section */}
          <section className="container py-24">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h2 className="font-pixel text-xl md:text-2xl leading-relaxed">ABOUT THE GALLERY</h2>
              <p className="font-retro text-2xl text-muted-foreground leading-snug">
                Prompted is a social party game that combines the power of artificial intelligence with
                your creativity. For the best experience, the host should use a laptop or connect to a TV screen
                that everyone can see, while players join on their mobile phones.
              </p>
              <p className="font-retro text-2xl text-muted-foreground leading-snug">
                Players take turns being the judge each round—the judge picks or creates a prompt, and everyone
                else competes to generate the best image to win the judge's approval. It's perfect for game nights,
                team building, or just hanging out with friends!
              </p>
            </div>
          </section>

          {/* How to Play Section */}
          <section className="container py-24 bg-muted/40 border-y-[3px] border-ink/10">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="font-pixel text-xl md:text-2xl leading-relaxed">THE CURATOR'S GUIDE</h2>
            <p className="font-retro text-2xl text-muted-foreground">Simple steps to open your creative competition</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* For Hosts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-pixel text-sm leading-relaxed">
                  <Users className="w-5 h-5 text-gal-velvet" />
                  FOR CURATORS (HOSTS)
                </CardTitle>
                <CardDescription className="font-retro text-lg">Control the game and facilitate the fun</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  'Create a game room on your laptop or computer (ideal for screen sharing to a TV)',
                  'Share the code or QR code with players',
                  'Start the game when everyone has joined',
                  'Monitor all player submissions on the big screen for everyone to see',
                  'Track scores across multiple rounds',
                ].map((step, i) => (
                  <div className="flex gap-3" key={i}>
                    <div className="plaque flex-shrink-0 w-7 h-7 flex items-center justify-center text-[10px]">
                      {i + 1}
                    </div>
                    <p className="font-retro text-xl leading-snug">{step}</p>
                  </div>
                ))}
                <div className="mt-4 p-3 border-2 border-ink bg-primary/15">
                  <p className="font-retro text-xl">★ Best played with your screen shared to a TV while players use their phones</p>
                </div>
              </CardContent>
            </Card>

            {/* For Players */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-pixel text-sm leading-relaxed">
                  <GamepadIcon className="w-5 h-5 text-gal-velvet" />
                  FOR ARTISTS (PLAYERS)
                </CardTitle>
                <CardDescription className="font-retro text-lg">Join on your phone for the best mobile experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  'Join with your name and room code on your mobile device',
                  'Wait for the host to start the game',
                  'One player is selected as the judge—they choose a prompt from the library or create their own',
                  "Generate your best image to impress the judge (if you're not the judge this round)",
                  "If you're the judge, review all submissions and pick your favorite. Otherwise, wait for the judge's decision!",
                  'Compete for points as the judge role rotates each round!',
                ].map((step, i) => (
                  <div className="flex gap-3" key={i}>
                    <div className="plaque flex-shrink-0 w-7 h-7 flex items-center justify-center text-[10px]">
                      {i + 1}
                    </div>
                    <p className="font-retro text-xl leading-snug">{step}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          </div>
        </section>

          {/* Key Features Section */}
          <section className="container py-24">
            <div className="max-w-5xl mx-auto space-y-12">
              <div className="text-center space-y-4">
                <h2 className="font-pixel text-xl md:text-2xl leading-relaxed">GALLERY AMENITIES</h2>
                <p className="font-retro text-2xl text-muted-foreground">Everything you need for an amazing game experience</p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {features.map((feature, index) => (
                  <Card key={index} className="animate-px-hop-in" style={{ animationDelay: `${index * 60}ms` }}>
                    <CardHeader>
                      <div className="plaque mb-3 inline-flex h-12 w-12 items-center justify-center self-start">
                        <feature.icon className="w-6 h-6" />
                      </div>
                      <CardTitle className="font-pixel text-xs leading-relaxed">{feature.title.toUpperCase()}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-retro text-xl text-muted-foreground leading-snug">{feature.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Game Roles Section */}
          <section className="container py-24 bg-muted/40 border-y-[3px] border-ink/10">
            <div className="max-w-4xl mx-auto space-y-12">
              <div className="text-center space-y-4">
                <h2 className="font-pixel text-xl md:text-2xl leading-relaxed">THE HOUSE ROLES</h2>
                <p className="font-retro text-2xl text-muted-foreground">Understanding your role in the game</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <div className="plaque mb-3 inline-flex h-12 w-12 items-center justify-center self-start">
                      <Users className="w-6 h-6" />
                    </div>
                    <CardTitle className="font-pixel text-xs leading-relaxed">THE CURATOR (HOST)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-retro text-xl text-muted-foreground leading-snug">
                      Controls the game flow, can see all players and submissions, and starts each round
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="plaque mb-3 inline-flex h-12 w-12 items-center justify-center self-start">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <CardTitle className="font-pixel text-xs leading-relaxed">THE CRITIC (JUDGE)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-retro text-xl text-muted-foreground leading-snug">
                      Rotates each round among all players. The judge selects or creates the creative prompt,
                      then reviews all submissions and picks their favorite winning image. You can't be the
                      judge and compete in the same round.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="plaque mb-3 inline-flex h-12 w-12 items-center justify-center self-start">
                      <GamepadIcon className="w-6 h-6" />
                    </div>
                    <CardTitle className="font-pixel text-xs leading-relaxed">THE ARTISTS (PLAYERS)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-retro text-xl text-muted-foreground leading-snug">
                      Create images based on prompts and vote on submissions to earn points
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* Perfect For Section */}
          <section className="container py-24">
            <div className="max-w-4xl mx-auto space-y-12">
              <div className="text-center space-y-4">
                <h2 className="font-pixel text-xl md:text-2xl leading-relaxed">SUITABLE OCCASIONS</h2>
                <p className="font-retro text-2xl text-muted-foreground">Great occasions to visit the gallery</p>
              </div>

              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                {useCases.map((useCase, index) => (
                  <Card key={index} className="text-center">
                    <CardContent className="pt-6 space-y-3">
                      <div className="plaque mx-auto inline-flex h-11 w-11 items-center justify-center">
                        <useCase.icon className="w-5 h-5" />
                      </div>
                      <p className="font-retro text-xl">{useCase.text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="container py-24 bg-muted/40 border-y-[3px] border-ink/10">
            <div className="max-w-3xl mx-auto space-y-12">
              <div className="text-center space-y-4">
                <h2 className="font-pixel text-xl md:text-2xl leading-relaxed">VISITOR INFORMATION</h2>
                <p className="font-retro text-2xl text-muted-foreground">Everything you need to know</p>
              </div>

              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="border-b-2 border-ink/20">
                    <AccordionTrigger className="text-left font-retro text-2xl hover:no-underline">{faq.question}</AccordionTrigger>
                    <AccordionContent className="font-retro text-xl text-muted-foreground leading-snug">{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>

          {/* Footer CTA — the velvet room */}
          <section className="container py-24">
            <div className="border-[3px] border-ink bg-gal-velvet text-secondary-foreground shadow-[8px_8px_0_0_hsl(var(--gal-gold))]">
              <div className="py-14 px-6">
                <div className="max-w-3xl mx-auto text-center space-y-8">
                  <h2 className="font-pixel text-lg md:text-2xl leading-relaxed">THE DOORS ARE OPEN</h2>
                  <p className="font-retro text-2xl opacity-90 leading-snug">
                    Join thousands of players creating amazing AI-generated images and competing with friends
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                      size="lg"
                      onClick={() => user ? setMode('create') : navigate('/auth?next=host')}
                      className="h-14 px-8"
                    >
                      <Users className="mr-2 w-5 h-5" />
                      Host an exhibition
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => setMode('join')}
                      className="h-14 px-8 px-btn bg-paper text-ink hover:bg-paper"
                    >
                      <QrCode className="mr-2 w-5 h-5" />
                      Enter as an artist
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t-[3px] border-ink">
            <div className="container py-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="plaque px-2 py-1.5 text-[9px]">▦</span>
                  <span className="font-pixel text-xs">PROMPTED — FINE ART, POORLY UNDERSTOOD</span>
                </div>
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSuggestionDialogOpen(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Mail className="w-4 h-4 md:mr-1" />
          <span className="hidden md:inline">Suggestion box</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
          Login
        </Button>
      </div>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
};

export default Landing;
