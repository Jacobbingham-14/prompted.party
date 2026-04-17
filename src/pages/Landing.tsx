import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserFriendlyErrorMessage, logErrorInDev } from "@/lib/errorUtils";
import { ArrowRight, PlayCircle } from "lucide-react";

// ─────────────────────────────────────────────
// Gallery Data
// ─────────────────────────────────────────────

const GALLERY_ITEMS = [
  { gradient: "from-violet-400 via-purple-500 to-pink-500",  emoji: "🦝", caption: "A raccoon running a startup",            prompt: "My sidekick",                       rotation: "-rotate-1" },
  { gradient: "from-emerald-400 via-teal-500 to-cyan-500",   emoji: "🦷", caption: "A dentist's worst nightmare",            prompt: "A dentist's worst nightmare",       rotation: "rotate-1"  },
  { gradient: "from-amber-400 via-orange-500 to-red-500",    emoji: "🧌", caption: "Shrek as a luxury perfume ad",           prompt: "My dream vacation",                 rotation: "-rotate-2" },
  { gradient: "from-blue-400 via-indigo-500 to-violet-500",  emoji: "👽", caption: "Area 51 gift shop",                     prompt: "What really happens in area 51",    rotation: "rotate-2"  },
  { gradient: "from-pink-400 via-rose-500 to-red-500",       emoji: "😾", caption: "A heated political debate (between cats)", prompt: "A heated political debate",       rotation: "rotate-1"  },
  { gradient: "from-lime-400 via-green-500 to-emerald-500",  emoji: "🏆", caption: "An award I definitely deserve",          prompt: "An award I deserve",               rotation: "-rotate-1" },
  { gradient: "from-cyan-400 via-sky-500 to-blue-500",       emoji: "🚀", caption: "How my father got to school",            prompt: "How my father got to school",      rotation: "rotate-2"  },
  { gradient: "from-fuchsia-400 via-purple-500 to-indigo-500", emoji: "🧙", caption: "Me as a movie hero",                  prompt: "Me as a movie hero",               rotation: "-rotate-2" },
];

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Room {
  id: string;
  code: string;
  status: string;
  created_at: string;
  host_id: string;
  game_mode?: string;
}

type PageMode = "marketing" | "create" | "join" | "active-games";

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

const Landing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<PageMode>("marketing");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [hostRooms, setHostRooms] = useState<Room[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchHostRooms(session.user.id);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchHostRooms(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  // URL param handling
  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl) {
      setRoomCode(codeFromUrl.toUpperCase());
      setMode("join");
    }
    const urlMode = searchParams.get("mode");
    if (urlMode === "host" && user) {
      setMode("create");
      navigate("/", { replace: true });
    } else if (urlMode === "join") {
      setMode("join");
    }
  }, [searchParams, user]);

  const fetchHostRooms = async (userId: string) => {
    const { data } = await supabase
      .from("rooms")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["waiting", "playing"])
      .order("created_at", { ascending: false });
    if (data) {
      setHostRooms(data as Room[]);
      if (data.length > 0 && mode === "marketing") setMode("active-games");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setHostRooms([]);
    setMode("marketing");
  };

  const handleCreateRoom = async (selectedGameMode: "judge" | "voting" | "forgery") => {
    if (!user) { navigate("/auth?next=host"); return; }
    setIsCreating(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data, error } = await supabase
        .from("rooms")
        .insert({ code, host_id: user.id, user_id: user.id, status: "waiting", game_mode: selectedGameMode })
        .select().single();
      if (error) throw error;
      localStorage.setItem("hostRoomId", data.id);
      navigate("/play?mode=host");
    } catch (error) {
      logErrorInDev("Create room error", error);
      toast({ title: "Error", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    setIsJoining(true);
    try {
      const { data: roomRows } = await supabase.rpc("find_room_by_code", { room_code: roomCode.toUpperCase() });
      const room = Array.isArray(roomRows) ? roomRows[0] : roomRows;
      if (!room) { toast({ title: "Room not found", description: "Check the code and try again", variant: "destructive" }); return; }
      if (room.status !== "waiting" && room.status !== "playing") { toast({ title: "Room closed", description: "This room is no longer active", variant: "destructive" }); return; }

      const { data: player, error } = await supabase
        .from("players")
        .insert({ room_id: room.id, name: playerName.trim(), score: 0 })
        .select().single();
      if (error) throw error;

      const codeUpper = roomCode.toUpperCase();
      localStorage.setItem("playerId", player.id);
      localStorage.setItem("roomId", room.id);
      localStorage.setItem("roomCode", codeUpper);
      navigate("/play", { state: { playerId: player.id, roomId: room.id, roomCode: codeUpper } });
    } catch (error) {
      logErrorInDev("Join room error", error);
      toast({ title: "Error", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
    } finally {
      setIsJoining(false);
    }
  };

  const handleEndRoom = async (roomId: string) => {
    if (!user) return;
    await supabase.rpc("delete_ended_room", { p_room_id: roomId, p_caller_id: user.id });
    fetchHostRooms(user.id);
  };

  // ─────────────────────────────────────────────
  // Shared header
  // ─────────────────────────────────────────────
  const Header = ({ showBack = false }: { showBack?: boolean }) => (
    <header className="sticky top-0 z-50 bg-[#f5f2eb]/90 backdrop-blur-sm border-b border-stone-200 px-6 py-4 flex items-center justify-between">
      <button onClick={() => setMode("marketing")} className="font-serif text-2xl font-bold tracking-tight text-stone-900 hover:opacity-70 transition-opacity">
        Prompted.
      </button>
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={() => setMode("marketing")} className="text-sm text-stone-500 hover:text-stone-800 transition-colors">
            ← Back
          </button>
        )}
        {!showBack && (
          <>
            {user ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setMode(hostRooms.length > 0 ? "active-games" : "create")} className="text-stone-600 hover:text-stone-900">
                  My Games
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-stone-500 hover:text-stone-800">
                  Sign Out
                </Button>
                <Button size="sm" onClick={() => setMode("create")} className="bg-stone-900 hover:bg-stone-800 text-white">
                  Host a Game
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-stone-500 hover:text-stone-800">
                  Sign In
                </Button>
                <Button size="sm" onClick={() => navigate("/auth?next=host")} className="bg-stone-900 hover:bg-stone-800 text-white">
                  Get Started
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </header>
  );

  // ─────────────────────────────────────────────
  // CREATE MODE
  // ─────────────────────────────────────────────
  if (mode === "create") {
    return (
      <div className="min-h-screen bg-[#f5f2eb] flex flex-col">
        <Header showBack />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg space-y-8">
            <div className="text-center space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-400 font-medium">Select Your Experience</p>
              <h1 className="font-serif text-4xl font-bold text-stone-900">Choose a Mode</h1>
            </div>
            <div className="space-y-3">
              {[
                { mode: "judge" as const, emoji: "⚖️", title: "Judge Mode", desc: "One judge picks the prompt. Everyone generates. The judge crowns a winner.", meta: "Takes turns judging" },
                { mode: "voting" as const, emoji: "🗳️", title: "Voting Mode", desc: "Everyone votes on the prompt. Everyone votes on the winner. Democracy, but chaotic.", meta: "Everyone votes" },
                { mode: "forgery" as const, emoji: "🕵️", title: "Forgery Mode", desc: "One player gets a different prompt. Can they blend in? Can you spot the forger?", meta: "Hidden roles" },
              ].map((item) => (
                <button
                  key={item.mode}
                  onClick={() => handleCreateRoom(item.mode)}
                  disabled={isCreating}
                  className="w-full group border border-stone-200 bg-white rounded-xl p-5 text-left hover:border-stone-900 hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{item.emoji}</span>
                      <div>
                        <h2 className="font-serif text-lg font-bold text-stone-900">{item.title}</h2>
                        <p className="text-stone-500 text-sm">{item.desc}</p>
                        <p className="text-xs text-stone-400 mt-1">3–12 players · {item.meta}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-stone-300 group-hover:text-stone-900 group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // JOIN MODE
  // ─────────────────────────────────────────────
  if (mode === "join") {
    return (
      <div className="min-h-screen bg-[#f5f2eb] flex flex-col">
        <Header showBack />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-8">
            <div className="text-center space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-400 font-medium">Join the Gallery</p>
              <h1 className="font-serif text-4xl font-bold text-stone-900">Enter the Room</h1>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-[0.15em] text-stone-500 font-medium">Your Name</label>
                <Input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="What do they call you?"
                  className="bg-white border-stone-200 focus:border-stone-900 h-12 text-base"
                  maxLength={20}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-[0.15em] text-stone-500 font-medium">Room Code</label>
                <Input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  className="bg-white border-stone-200 focus:border-stone-900 h-12 text-base font-mono text-center tracking-[0.4em] uppercase"
                  maxLength={6}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                />
              </div>
              <Button
                onClick={handleJoinRoom}
                disabled={!playerName.trim() || roomCode.length < 6 || isJoining}
                className="w-full h-12 text-base bg-stone-900 hover:bg-stone-800 text-white"
              >
                {isJoining ? "Entering…" : "Enter the Gallery →"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // ACTIVE GAMES MODE
  // ─────────────────────────────────────────────
  if (mode === "active-games" && user) {
    return (
      <div className="min-h-screen bg-[#f5f2eb] flex flex-col">
        <Header showBack />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg space-y-6">
            <div className="text-center space-y-1">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-400 font-medium">Your Games</p>
              <h1 className="font-serif text-3xl font-bold text-stone-900">Active Rooms</h1>
            </div>
            {hostRooms.map((room) => (
              <div key={room.id} className="bg-white border border-stone-200 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold text-xl text-stone-900 tracking-widest">{room.code}</p>
                  <p className="text-sm text-stone-500 capitalize">{room.game_mode || "judge"} mode · {room.status}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEndRoom(room.id)} className="text-stone-500 border-stone-200">
                    Close
                  </Button>
                  <Button size="sm" onClick={() => {
                    localStorage.setItem("hostRoomId", room.id);
                    navigate("/play?mode=host");
                  }} className="bg-stone-900 hover:bg-stone-800 text-white">
                    Continue →
                  </Button>
                </div>
              </div>
            ))}
            <Button onClick={() => setMode("create")} variant="outline" className="w-full border-stone-200 text-stone-700">
              + Create New Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // MARKETING (main landing)
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f2eb] font-sans overflow-x-hidden">
      <Header />

      {/* ── Hero ── */}
      <section className="px-6 pt-24 pb-20 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div className="space-y-8">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400 font-medium">The AI Image Party Game</p>
              <h1 className="font-serif text-7xl lg:text-8xl font-bold text-stone-900 leading-[0.9]">
                Prompted.
              </h1>
              <p className="text-xl text-stone-500 leading-relaxed max-w-sm">
                Get a prompt. Generate something absurd.<br />
                Try not to embarrass yourself.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                onClick={() => user ? setMode("create") : navigate("/auth?next=host")}
                className="bg-stone-900 hover:bg-stone-800 text-white h-12 px-8 text-base font-medium"
              >
                Host a Game <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setMode("join")}
                className="border-stone-300 text-stone-700 hover:bg-stone-100 h-12 px-8 text-base"
              >
                Join a Game
              </Button>
            </div>
            <p className="text-xs text-stone-400">Free · No download · Works on any device</p>
          </div>

          {/* Right: animated gallery grid */}
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            {GALLERY_ITEMS.slice(0, 4).map((item, i) => (
              <div
                key={i}
                className={`group relative aspect-square rounded-2xl overflow-hidden border border-stone-200/80 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 ${item.rotation} cursor-pointer`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-90`} />
                {/* Gallery frame inset */}
                <div className="absolute inset-3 border border-white/20 rounded-xl pointer-events-none" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-6xl drop-shadow-lg select-none" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' }}>
                    {item.emoji}
                  </span>
                </div>
                {/* Hover caption */}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-start justify-end p-4">
                  <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Prompt</p>
                  <p className="text-white text-sm font-medium leading-snug">"{item.caption}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Exhibit ── */}
      <section className="bg-white border-y border-stone-200 py-24 px-6">
        <div className="max-w-6xl mx-auto space-y-14">
          <div className="text-center space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400 font-medium">The Exhibit</p>
            <h2 className="font-serif text-5xl font-bold text-stone-900">Recent Masterpieces</h2>
            <p className="text-stone-500">Submitted by real players. Judged by their peers. Remembered forever.</p>
          </div>

          {/* Masonry-style grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {GALLERY_ITEMS.map((item, i) => {
              const isFeatured = i === 0 || i === 5;
              return (
                <div
                  key={i}
                  className={`group relative rounded-2xl overflow-hidden border border-stone-200 shadow-sm hover:shadow-xl transition-all duration-400 hover:-translate-y-1 cursor-pointer ${isFeatured ? "md:col-span-2 aspect-[2/1]" : "aspect-square"} ${item.rotation}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient}`} />
                  {/* Frame */}
                  <div className="absolute inset-2 border border-white/15 rounded-xl pointer-events-none" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`select-none drop-shadow-lg ${isFeatured ? "text-8xl" : "text-5xl"}`}>
                      {item.emoji}
                    </span>
                  </div>
                  {/* Slide-up caption */}
                  <div className="absolute bottom-0 inset-x-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out bg-gradient-to-t from-black/80 to-transparent p-4 pt-8">
                    <p className="text-white text-xs font-semibold leading-snug">"{item.caption}"</p>
                    <p className="text-white/50 text-xs mt-0.5 font-mono">{item.prompt}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <div className="text-center space-y-2 mb-20">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400 font-medium">The Rules</p>
          <h2 className="font-serif text-5xl font-bold text-stone-900">Three steps to chaos.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-12">
          {[
            { num: "01", emoji: "📜", title: "Get a Prompt", body: "The judge picks a prompt. Everyone gets the same challenge. No excuses." },
            { num: "02", emoji: "🎨", title: "Generate an Image", body: "Use AI to create your masterpiece. It will be weird. That's the point." },
            { num: "03", emoji: "🏆", title: "Get Judged", body: "The judge picks a winner. Points are awarded. Dignity is optional." },
          ].map((step) => (
            <div key={step.num} className="text-center space-y-5 group">
              <div className="relative inline-flex items-center justify-center w-24 h-24">
                <span className="font-serif text-8xl font-bold text-stone-100 group-hover:text-stone-200 transition-colors leading-none select-none">
                  {step.num}
                </span>
                <span className="absolute text-4xl">{step.emoji}</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-serif text-xl font-bold text-stone-900">{step.title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-stone-900 py-28 px-6 text-center">
        <div className="max-w-xl mx-auto space-y-8">
          <div className="space-y-3">
            <h2 className="font-serif text-6xl font-bold text-white leading-tight">
              Play tonight.
            </h2>
            <p className="text-stone-400 text-lg">Free. No app. Just a room code and your dignity.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              onClick={() => user ? setMode("create") : navigate("/auth?next=host")}
              className="bg-white hover:bg-stone-100 text-stone-900 h-12 px-8 text-base font-medium"
            >
              Host a Game <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setMode("join")}
              className="border-stone-600 text-white hover:bg-stone-800 h-12 px-8 text-base"
            >
              Join a Game
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-8 border-t border-stone-200 flex items-center justify-between text-xs text-stone-400">
        <span className="font-serif text-stone-600 font-semibold">Prompted.</span>
        <span>© 2026 · <button onClick={() => navigate("/auth")} className="hover:text-stone-600 transition-colors">Sign In</button></span>
      </footer>
    </div>
  );
};

export default Landing;
