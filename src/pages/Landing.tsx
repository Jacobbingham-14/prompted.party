import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Wifi,
  ArrowRight,
  Check,
  ChevronDown,
  Mail,
} from "lucide-react";
import { validateSuggestionForm } from "@/lib/validation";

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
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="font-bold text-xl">Prompted</span>
            
            {/* Suggestions Button */}
            <Dialog open={suggestionDialogOpen} onOpenChange={setSuggestionDialogOpen}>
              <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-2 text-muted-foreground hover:text-foreground">
                <Mail className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline">Suggestions or Prompt Ideas?</span>
              </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Share Your Suggestions or Prompt Ideas</DialogTitle>
                </DialogHeader>
                
                {!user ? (
                  // Show login prompt if not authenticated
                  <div className="space-y-4 mt-4 text-center py-8">
                    <p className="text-muted-foreground">
                      Please log in to submit suggestions and prompt ideas.
                    </p>
                    <Button onClick={() => {
                      setSuggestionDialogOpen(false);
                      navigate('/auth');
                    }}>
                      Log In to Submit
                    </Button>
                  </div>
                ) : (
                  // Show form if authenticated
                  <form onSubmit={handleSuggestionSubmit} className="space-y-4 mt-4">
                    <div className="text-sm text-muted-foreground">
                      Submitting as: <span className="font-medium text-foreground">{user.email}</span>
                    </div>
                    
                    <div>
                      <Label htmlFor="suggestion-message">Your Suggestion or Prompt Idea</Label>
                      <Textarea
                        id="suggestion-message"
                        placeholder="Share your ideas for new prompts or suggestions to improve the game..."
                        value={suggestionForm.message}
                        onChange={(e) => setSuggestionForm({ ...suggestionForm, message: e.target.value })}
                        required
                        minLength={10}
                        maxLength={2000}
                        rows={8}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
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
                        {isSubmittingSuggestion ? "Sending..." : "Send Suggestion"}
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
                  <Button variant="ghost" className="gap-1">
                    {user.email}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover">
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
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
            <h1 className="text-3xl font-bold text-center mb-4">Your Active Games</h1>
            
            <div className="space-y-3">
              {hostRooms.map(room => (
                <Card key={room.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xl font-bold">{room.code}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {room.status}
                        </p>
                        <p className="text-xs text-muted-foreground">
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
            <h1 className="text-4xl font-bold text-center mb-8">Select Game Mode</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                onClick={() => setGameMode('judge')}
                className={`p-8 cursor-pointer transition-all hover:scale-105 ${
                  gameMode === 'judge'
                    ? 'ring-4 ring-primary bg-primary/10'
                    : 'hover:shadow-lg'
                }`}
              >
                <CardContent className="p-0 space-y-4">
                  <h3 className="font-bold text-2xl">Judge Mode</h3>
                  <p className="text-muted-foreground">
                    One player judges and selects the winning image each round. Classic gameplay!
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Rotating judge each round</li>
                    <li>• Judge picks the winner</li>
                    <li>• Requires 3+ players</li>
                  </ul>
                </CardContent>
              </Card>

              <Card
                onClick={() => setGameMode('voting')}
                className={`p-8 cursor-pointer transition-all hover:scale-105 ${
                  gameMode === 'voting'
                    ? 'ring-4 ring-primary bg-primary/10'
                    : 'hover:shadow-lg'
                }`}
              >
                <CardContent className="p-0 space-y-4">
                  <h3 className="font-bold text-2xl">Voting Mode</h3>
                  <p className="text-muted-foreground">
                    All players vote for prompts and images. More democratic and engaging!
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Everyone votes on prompts</li>
                    <li>• Everyone votes on images</li>
                    <li>• Requires 3+ players</li>
                  </ul>
                </CardContent>
              </Card>

              <Card
                onClick={() => setGameMode('forgery')}
                className={`p-8 cursor-pointer transition-all hover:scale-105 ${
                  gameMode === 'forgery'
                    ? 'ring-4 ring-primary bg-primary/10'
                    : 'hover:shadow-lg'
                }`}
              >
                <CardContent className="p-0 space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-2xl">Forgery Mode</h3>
                    <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground animate-pulse">NEW!</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Secret agents receive different prompts. Can you spot the forger?
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Secret prompt assignments</li>
                    <li>• Vote to identify the forger</li>
                    <li>• Requires 3+ players</li>
                  </ul>
                </CardContent>
              </Card>

              <Card
                onClick={() => setGameMode('duel')}
                className={`p-8 cursor-pointer transition-all hover:scale-105 ${
                  gameMode === 'duel'
                    ? 'ring-4 ring-primary bg-primary/10'
                    : 'hover:shadow-lg'
                }`}
              >
                <CardContent className="p-0 space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-2xl">Prompt Duel</h3>
                    <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground animate-pulse">NEW!</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Head-to-head matchups. Write the funnier answer, then everyone votes!
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Two prompts per player each round</li>
                    <li>• One matchup revealed at a time</li>
                    <li>• 3 rounds, rising stakes · 3+ players</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-4">
              <Button 
                onClick={() => setMode(user && hostRooms.length > 0 ? 'active-games' : 'marketing')}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button 
                onClick={() => handleCreateRoom(gameMode)}
                className="flex-1"
                size="lg"
              >
                Create {gameMode === 'judge' ? 'Judge' : gameMode === 'voting' ? 'Voting' : gameMode === 'forgery' ? 'Forgery' : 'Prompt Duel'} Game
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Join Game Form */}
      {mode === 'join' && (
        <section className="container py-24">
          <div className="max-w-md mx-auto space-y-4">
            <h1 className="text-3xl font-bold text-center mb-4">Join Game</h1>
            
            {/* Name Input - Always shown */}
            <Input
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={50}
              disabled={isJoining}
              className="h-12 text-lg"
              autoFocus
            />

            {/* Room Code - Conditional rendering based on URL parameter */}
            {searchParams.get('code') ? (
              // Code from QR - show as read-only badge
              <div className="p-4 bg-muted rounded-lg border-2 border-border text-center">
                <p className="text-sm text-muted-foreground mb-1">Joining room:</p>
                <p className="text-2xl font-bold tracking-widest text-foreground">{roomCode}</p>
              </div>
            ) : (
              // Manual join - show editable input
              <Input
                placeholder="Room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={12}
                disabled={isJoining}
                className="h-12 text-lg"
              />
            )}

            <Button
              onClick={() => handleJoinRoom(playerName, roomCode)}
              disabled={!playerName.trim() || !roomCode.trim() || isJoining}
              className="w-full h-12 text-lg"
            >
              {isJoining ? 'Joining…' : 'Join Room'}
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
          <section className="container py-24 md:py-32">
            <div className="flex flex-col items-center text-center space-y-8">
              <Badge variant="secondary" className="text-sm">
                <Sparkles className="w-3 h-3 mr-1" />
                Powered by AI
              </Badge>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
                <span className="text-primary text-5xl md:text-7xl lg:text-8xl block mb-2">Prompted</span>
                <span className="text-2xl md:text-4xl lg:text-5xl block text-foreground">The AI Image Party Game</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl">
                A multiplayer party game where <span className="text-primary font-semibold">creativity meets AI</span>. Players use AI to create images based on creative prompts, then vote on the best submissions to earn points.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={() => user ? setMode('create') : navigate('/auth?next=host')} className="text-lg">
                  <Users className="mr-2 w-5 h-5" />
                  Host a Game
                </Button>
                <Button size="lg" variant="outline" onClick={() => setMode('join')} className="text-lg">
                  <QrCode className="mr-2 w-5 h-5" />
                  Join a Game
                </Button>
              </div>
            </div>
          </section>

          <Separator className="container" />

          {/* What Is This Game Section */}
          <section className="container py-24">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">What Is Prompted?</h2>
              <p className="text-lg text-muted-foreground">
                Prompted is a social party game that combines the power of artificial intelligence with
                your creativity. For the best experience, the host should use a laptop or connect to a TV screen
                that everyone can see, while players join on their mobile phones.
              </p>
              <p className="text-lg text-muted-foreground">
                Players take turns being the judge each round—the judge picks or creates a prompt, and everyone
                else competes to generate the best image to win the judge's approval. It's perfect for game nights,
                team building, or just hanging out with friends!
              </p>
            </div>
          </section>

          {/* How to Play Section */}
          <section className="container py-24 bg-muted/30">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">How to Play</h2>
            <p className="text-lg text-muted-foreground">Simple steps to start your creative competition</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* For Hosts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  For Hosts
                </CardTitle>
                <CardDescription>Control the game and facilitate the fun</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <p className="text-sm">Create a game room on your laptop or computer (ideal for screen sharing to a TV)</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <p className="text-sm">Share the code or QR code with players</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <p className="text-sm">Start the game when everyone has joined</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    4
                  </div>
                  <p className="text-sm">Monitor all player submissions on the big screen for everyone to see</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    5
                  </div>
                  <p className="text-sm">Track scores across multiple rounds</p>
                </div>
                <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm">💡 Best played with your screen shared to a TV while players use their phones</p>
                </div>
              </CardContent>
            </Card>

            {/* For Players */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GamepadIcon className="w-5 h-5 text-primary" />
                  For Players
                </CardTitle>
                <CardDescription>Join on your phone for the best mobile experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <p className="text-sm">Join with your name and room code on your mobile device</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <p className="text-sm">Wait for the host to start the game</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <p className="text-sm">One player is selected as the judge—they choose a prompt from the library or create their own</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    4
                  </div>
                  <p className="text-sm">Generate your best image to impress the judge (if you're not the judge this round)</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    5
                  </div>
                  <p className="text-sm">If you're the judge, review all submissions and pick your favorite. Otherwise, wait for the judge's decision!</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    6
                  </div>
                  <p className="text-sm">Compete for points as the judge role rotates each round!</p>
                </div>
              </CardContent>
            </Card>
          </div>
          </div>
        </section>

          {/* Key Features Section */}
          <section className="container py-24">
            <div className="max-w-5xl mx-auto space-y-12">
              <div className="text-center space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold">Key Features</h2>
                <p className="text-lg text-muted-foreground">Everything you need for an amazing game experience</p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {features.map((feature, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <feature.icon className="w-10 h-10 text-primary mb-2" />
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Game Roles Section */}
          <section className="container py-24 bg-muted/30">
            <div className="max-w-4xl mx-auto space-y-12">
              <div className="text-center space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold">Game Roles Explained</h2>
                <p className="text-lg text-muted-foreground">Understanding your role in the game</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <Users className="w-10 h-10 text-primary mb-2" />
                    <CardTitle>Host</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Controls the game flow, can see all players and submissions, and starts each round
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <Trophy className="w-10 h-10 text-primary mb-2" />
                    <CardTitle>Judge</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Rotates each round among all players. The judge selects or creates the creative prompt,
                      then reviews all submissions and picks their favorite winning image. You can't be the
                      judge and compete in the same round.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <GamepadIcon className="w-10 h-10 text-primary mb-2" />
                    <CardTitle>Players</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
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
                <h2 className="text-3xl md:text-4xl font-bold">Perfect For</h2>
                <p className="text-lg text-muted-foreground">Great occasions to play Prompted</p>
              </div>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {useCases.map((useCase, index) => (
                  <Card key={index} className="text-center">
                    <CardContent className="pt-6 space-y-2">
                      <useCase.icon className="w-8 h-8 text-primary mx-auto" />
                      <p className="text-sm font-medium">{useCase.text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="container py-24 bg-muted/30">
            <div className="max-w-3xl mx-auto space-y-12">
              <div className="text-center space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold">Frequently Asked Questions</h2>
                <p className="text-lg text-muted-foreground">Everything you need to know</p>
              </div>

              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>

          {/* Footer CTA */}
          <section className="container py-24">
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="py-12">
                <div className="max-w-3xl mx-auto text-center space-y-8">
                  <h2 className="text-3xl md:text-4xl font-bold">Ready to Start Playing?</h2>
                  <p className="text-lg opacity-90">
                    Join thousands of players creating amazing AI-generated images and competing with friends
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                      size="lg"
                      variant="secondary"
                      onClick={() => user ? setMode('create') : navigate('/auth?next=host')}
                      className="text-lg"
                    >
                      <Users className="mr-2 w-5 h-5" />
                      Host a Game
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => setMode('join')}
                      className="text-lg bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                    >
                      <QrCode className="mr-2 w-5 h-5" />
                      Join a Game
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Footer */}
          <footer className="border-t">
            <div className="container py-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Prompted</span>
                </div>
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setSuggestionDialogOpen(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Mail className="w-4 h-4 md:mr-1" />
          <span className="hidden md:inline">Suggestions or Prompt Ideas?</span>
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
