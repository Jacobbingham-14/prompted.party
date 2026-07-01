import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import Lobby from '@/components/Lobby';
import RoundStart from '@/components/RoundStart';
import ImageSubmission from '@/components/ImageSubmission';
import JudgeView from '@/components/JudgeView';
import Scoreboard from '@/components/Scoreboard';
import HostWaitingView from '@/components/HostWaitingView';
import JudgeWaitingView from '@/components/JudgeWaitingView';
import HostImageGallery from '@/components/HostImageGallery';
import PromptVoting from '@/components/PromptVoting';
import HostPromptVoting from '@/components/HostPromptVoting';
import ImagePresentation from '@/components/ImagePresentation';
import HostImagePresentation from '@/components/HostImagePresentation';
import ImageVoting from '@/components/ImageVoting';
import HostImageVoting from '@/components/HostImageVoting';
import WinnerReveal from '@/components/WinnerReveal';
import GameEndedScreen from '@/components/GameEndedScreen';
import ForgeryRoundStart from '@/components/ForgeryRoundStart';
import ForgeryVoting from '@/components/ForgeryVoting';
import HostForgeryVoting from '@/components/HostForgeryVoting';
import ForgeryReveal from '@/components/ForgeryReveal';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { validatePlayerName } from '@/lib/validation';
import { getUserFriendlyErrorMessage, logErrorInDev } from '@/lib/errorUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type GameState = 'home' | 'select-room' | 'lobby' | 'round-start' | 'prompt-voting' | 'submitting' | 'presenting' | 'image-voting' | 'judging' | 'winner-reveal' | 'scoreboard' | 'game-ended' | 'forgery-round-start' | 'forgery-voting' | 'forgery-reveal';

interface Player {
  id: string;
  name: string;
  score: number;
  is_judge: boolean;
  room_id: string;
  avatar_url?: string | null;
}

interface Room {
  id: string;
  code: string;
  status: string;
  host_id: string;
  created_at: string;
  game_mode: 'judge' | 'voting' | 'forgery';
}

interface ForgeryVote {
  voter_id: string;
  accused_player_id: string;
}

interface Round {
  id: string;
  round_number: number;
  judge_id: string | null;
  status: string;
  room_id: string;
  prompt: string | null;
  selected_prompts: string[] | null;
  winning_submission_ids: string[] | null;
  presentation_order?: string[] | null;
}

interface PromptVote {
  id: string;
  round_id: string;
  player_id: string;
  prompt_text: string;
  created_at: string;
}

interface ImageVote {
  id: string;
  round_id: string;
  voter_id: string;
  submission_id: string;
  created_at: string;
}

interface Submission {
  id: string;
  player_id: string;
  image_url: string;
  is_winner: boolean;
  player_name?: string;
}

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isInitializing, setIsInitializing] = useState(true);
  const [gameState, setGameState] = useState<GameState>('home');
  const [roomId, setRoomId] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [hostRooms, setHostRooms] = useState<Room[]>([]);
  const [promptVotes, setPromptVotes] = useState<PromptVote[]>([]);
  const [imageVotes, setImageVotes] = useState<ImageVote[]>([]);
  const [currentPromptVote, setCurrentPromptVote] = useState<string | null>(null);
  const [currentImageVote, setCurrentImageVote] = useState<string | null>(null);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [isRevoting, setIsRevoting] = useState(false);
  const [tiedPrompts, setTiedPrompts] = useState<string[]>([]);
  const [isRevotingImages, setIsRevotingImages] = useState(false);
  const [tiedImageIds, setTiedImageIds] = useState<string[]>([]);
  const [showNoVotesAlert, setShowNoVotesAlert] = useState(false);
  // Forgery mode state
  const [forgeryVotes, setForgeryVotes] = useState<ForgeryVote[]>([]);
  const [currentForgeryVote, setCurrentForgeryVote] = useState<string | null>(null);
  const [forgeryForgerIds, setForgeryForgerIds] = useState<string[]>([]);
  const [forgeryScoreChanges, setForgeryScoreChanges] = useState<Record<string, number>>({});
  const [playerForgeryPrompt, setPlayerForgeryPrompt] = useState<string | null>(null);
  const { toast } = useToast();

  // Prevents host double-clicks from firing a state-transition handler twice
  // (double round creation, double score increment, etc.). Each guarded
  // handler wraps its body in withGuard('unique-key', ...).
  const inFlightRef = useRef<Set<string>>(new Set());
  const withGuard = async (key: string, fn: () => Promise<void>): Promise<void> => {
    if (inFlightRef.current.has(key)) return;
    inFlightRef.current.add(key);
    try {
      await fn();
    } finally {
      inFlightRef.current.delete(key);
    }
  };

  // NOTE: Client-side host check is for UI rendering only, NOT for authorization
  // All privileged operations are protected by RLS policies and server-side checks
  // This variable controls visibility of host UI elements but does not grant actual permissions
  const urlParams = new URLSearchParams(window.location.search);
  const isModeHost = urlParams.get('mode') === 'host';
  const storedHostRoomId = localStorage.getItem('hostRoomId');
  const isHostBySession = !!user && room?.host_id === user.id;
  const isHostByStorage = storedHostRoomId === roomId;
  console.log('[Host Check]', {
    isHostBySession,
    isHostByStorage,
    isModeHost,
    user: !!user,
    roomId,
    storedHostRoomId,
    roomHostId: room?.host_id
  });
  const isHost = isHostBySession || isHostByStorage || isModeHost;
  const currentPlayer = players.find(p => p.id === playerId);
  const isJudge = (currentRound?.judge_id === playerId) || (currentPlayer?.is_judge === true);
  const judgePlayer = players.find(p => p.id === currentRound?.judge_id);

  // Initialize game context on mount
  useEffect(() => {
    const initializeGameContext = async () => {
      console.log('[Index] Initializing game context...');
      
      // Check for host room context
      const storedHostRoomId = localStorage.getItem('hostRoomId');
      if (storedHostRoomId) {
        console.log('[Index] Found hostRoomId in localStorage:', storedHostRoomId);
        
        // Fetch the room to verify it exists and is active
        const { data: roomData, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', storedHostRoomId)
          .in('status', ['waiting', 'playing'])
          .maybeSingle();
        
        if (roomData && !error) {
          console.log('[Index] Host room found, setting up lobby state');
          setRoomId(roomData.id);
          setRoomCode(roomData.code);
          setRoom(roomData as Room);
          setGameState('lobby');
          setIsInitializing(false);
          return;
        } else {
          console.log('[Index] Host room not found or inactive, clearing localStorage');
          localStorage.removeItem('hostRoomId');
        }
      }
      
      // Check for player context - prioritize location state (from navigation) over localStorage
      const locationState = location.state as { playerId?: string; roomId?: string; roomCode?: string } | null;
      const storedPlayerId = locationState?.playerId || localStorage.getItem('playerId');
      const storedRoomId = locationState?.roomId || localStorage.getItem('roomId');
      const storedRoomCode = locationState?.roomCode || localStorage.getItem('roomCode');
      
      // If we got data from location.state, also save to localStorage for persistence
      if (locationState?.playerId && locationState?.roomId) {
        localStorage.setItem('playerId', locationState.playerId);
        localStorage.setItem('roomId', locationState.roomId);
        localStorage.setItem('roomCode', locationState.roomCode || '');
      }
      
      if (storedPlayerId && storedRoomId) {
        console.log('[Index] Found player context in localStorage');
        
        // Fetch player and room to verify they exist
        const { data: playerData } = await supabase
          .from('players')
          .select('*')
          .eq('id', storedPlayerId)
          .maybeSingle();
        
        let roomData: any = null;
        if (session?.user) {
          const { data } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', storedRoomId)
            .in('status', ['waiting', 'playing'])
            .maybeSingle();
          roomData = data;
        } else {
          const { data: roomRows } = await supabase.rpc('find_room_by_code', {
            room_code: storedRoomCode as string,
          });
          const rpcRoom = Array.isArray(roomRows) ? roomRows[0] : roomRows;
          if (rpcRoom && ['waiting', 'playing'].includes(rpcRoom.status) && rpcRoom.id === storedRoomId) {
            roomData = rpcRoom;
          }
        }
        
        const isRoomValid = session?.user ? !!roomData : !!playerData && !!storedRoomId && !!storedRoomCode;
        if (isRoomValid) {
          console.log('[Index] Context valid, entering lobby');
          setPlayerId((playerData?.id as string) || (storedPlayerId as string));
          setRoomId(((roomData?.id as string) || (storedRoomId as string)));
          setRoomCode(((roomData?.code as string) || (storedRoomCode as string) || ''));
          if (roomData) setRoom(roomData as Room);
          setGameState('lobby');
          setIsInitializing(false);
          return;
        } else {
          console.log('[Index] Player or room not valid, clearing localStorage');
          localStorage.removeItem('playerId');
          localStorage.removeItem('roomId');
          localStorage.removeItem('roomCode');
        }
      }
      
      // No active game context found
      // Check if there's a code in the URL - if so, redirect to Landing with the code
      const initUrlParams = new URLSearchParams(window.location.search);
      const codeFromUrl = initUrlParams.get('code');
      
      if (codeFromUrl) {
        console.log('[Index] Code in URL but no game context, redirecting to join on Landing');
        navigate(`/?code=${encodeURIComponent(codeFromUrl)}`, { replace: true });
        setIsInitializing(false);
        return;
      }
      
      console.log('[Index] No active game context found');
      setIsInitializing(false);
    };
    
    initializeGameContext();
  }, []); // Run once on mount

  // Auth state management
  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] State change:', event, 'User:', session?.user?.id || 'null');
        setSession(session);
        setUser(session?.user ?? null);
        
        // When user logs in, fetch their active rooms
        if (session?.user) {
          console.log('[Auth] User authenticated, fetching host rooms');
          setTimeout(() => {
            fetchHostRooms(session.user.id);
          }, 0);
        } else {
          console.log('[Auth] User logged out or session lost');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] Initial session check:', session?.user?.id || 'no session');
      setSession(session);
      setUser(session?.user ?? null);
      
      // Fetch active rooms for logged in host
      if (session?.user) {
        fetchHostRooms(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-restore session from localStorage if valid
  useEffect(() => {
    // Check for reset parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === '1') {
      localStorage.removeItem('gameSession');
      localStorage.removeItem('roomId');
      localStorage.removeItem('roomCode');
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const restoreSession = async () => {
      // For authenticated hosts, restore their last active room
      if (session?.user) {
        const storedRoomId = localStorage.getItem('hostRoomId');
        if (storedRoomId) {
          // Verify room still exists and is active
          const { data: room } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', storedRoomId)
            .eq('user_id', session.user.id)
            .in('status', ['waiting', 'playing'])
            .maybeSingle();
          
          if (room) {
            setRoomId(room.id);
            setRoomCode(room.code);
            // Real-time subscriptions will load the rest
            return;
          } else {
            // Room no longer valid, clear it
            localStorage.removeItem('hostRoomId');
          }
        }
        return; // Don't proceed to player session restoration
      }

      // For players (non-authenticated)
      const stored = localStorage.getItem('gameSession');
      if (!stored) return;
      
      try {
        const sessionData = JSON.parse(stored);
        
        // Validate the room still exists and is active
        const { data: roomRows } = await supabase.rpc('find_room_by_code', {
          room_code: sessionData.roomCode
        });
        const room = Array.isArray(roomRows) ? roomRows[0] : roomRows;
        
        // Only restore if room is actually active (waiting or playing)
        // If room is ended, finished, or doesn't exist, clear the session
        if (!room || !['waiting', 'playing'].includes(room.status)) {
          localStorage.removeItem('gameSession');
          return;
        }
        
        // Validate the player still exists in this room
        const { data: player } = await supabase
          .from('players')
          .select('*')
          .eq('id', sessionData.playerId)
          .eq('room_id', sessionData.roomId)
          .maybeSingle();
        
        // If player was removed, clear invalid session
        if (!player) {
          localStorage.removeItem('gameSession');
          return;
        }
        
        // Valid session - restore state
        setRoomId(sessionData.roomId);
        setRoomCode(sessionData.roomCode);
        setPlayerId(sessionData.playerId);
        // The existing real-time subscriptions will handle loading
        // the correct game state based on room status
        
      } catch (error) {
        console.error('Error restoring session:', error);
        localStorage.removeItem('gameSession');
      }
    };
    
    restoreSession();
  }, [session]);

  // Real-time subscriptions
  useEffect(() => {
    if (!roomId) return;

    // Fetch initial data when roomId is available
    fetchPlayers();
    fetchRoom();
    fetchCurrentRound();

    const playersChannel = supabase
      .channel('players-changes')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          // If the current player's own record was deleted, the host ended the game
          if (payload.old?.id === playerId) {
            setGameState('game-ended');
          } else {
            fetchPlayers();
          }
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        () => fetchPlayers()
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        () => fetchPlayers()
      )
      .subscribe();

    const roomsChannel = supabase
      .channel('rooms-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, 
        () => fetchRoom()
      )
      .subscribe();

    const roundsChannel = supabase
      .channel('rounds-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `room_id=eq.${roomId}` }, 
        () => fetchCurrentRound()
      )
      .subscribe();

    const submissionsChannel = supabase
      .channel('submissions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `round_id=eq.${currentRound?.id}` }, 
        () => currentRound && fetchSubmissions(currentRound.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(roundsChannel);
      supabase.removeChannel(submissionsChannel);
    };
  }, [roomId, currentRound?.id]);

  // Dedicated submissions subscription and fetch
  useEffect(() => {
    if (!currentRound?.id) return;
    
    console.log('📡 Setting up submissions subscription for round:', currentRound.id);
    
    // Immediately fetch submissions when round is available
    fetchSubmissions(currentRound.id);
    
    // Set up real-time subscription for this specific round
    const submissionsChannel = supabase
      .channel(`submissions-${currentRound.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'submissions', 
        filter: `round_id=eq.${currentRound.id}` 
      }, (payload) => {
        console.log('🔔 Submission change detected!', payload);
        console.log('Event type:', payload.eventType);
        console.log('Refetching submissions...');
        fetchSubmissions(currentRound.id);
      })
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('📡 Cleaning up submissions subscription');
      supabase.removeChannel(submissionsChannel);
    };
  }, [currentRound?.id]);


  // Sync game state with current round status (primary driver for all players)
  useEffect(() => {
    if (!currentRound) return;
    
    console.log('[State Sync] Round status:', currentRound.status);
    
    if (currentRound.status === 'not_started') {
      setGameState('round-start');
    } else if (currentRound.status === 'prompt-voting') {
      setGameState('prompt-voting');
    } else if (currentRound.status === 'submitting') {
      fetchSubmissions(currentRound.id);
      setGameState('submitting');
    } else if (currentRound.status === 'judging') {
      console.log('[State Sync] Transitioning to judging state');
      fetchSubmissions(currentRound.id);
      setGameState('judging');
    } else if (currentRound.status === 'presenting') {
      console.log('Entering presenting state, fetching submissions...');
      fetchSubmissions(currentRound.id);
      setGameState('presenting');
    } else if (currentRound.status === 'image-voting') {
      console.log('Entering image voting state, submissions count:', submissions.length);
      // Fetch again to be safe
      if (submissions.length === 0) {
        console.log('No submissions found, fetching...');
        fetchSubmissions(currentRound.id);
      }
      setGameState('image-voting');
    } else if (currentRound.status === 'forgery-prompt-assigned') {
      setGameState('forgery-round-start');
    } else if (currentRound.status === 'forgery-voting') {
      fetchSubmissions(currentRound.id);
      fetchForgeryVotes(currentRound.id);
      setGameState('forgery-voting');
    } else if (currentRound.status === 'forgery-reveal') {
      fetchForgeryVotes(currentRound.id);
      setGameState('forgery-reveal');
    } else if (currentRound.status === 'complete' && room?.game_mode === 'forgery') {
      setGameState('scoreboard');
    }
  }, [currentRound?.status]);

  // Subscribe to prompt votes (voting mode only)
  useEffect(() => {
    if (!currentRound?.id || room?.game_mode !== 'voting') return;
    
    const fetchPromptVotes = async () => {
      const { data } = await supabase
        .from('prompt_votes')
        .select('*')
        .eq('round_id', currentRound.id);
      if (data) setPromptVotes(data as PromptVote[]);
    };

    fetchPromptVotes();
    
    const channel = supabase
      .channel(`prompt-votes-${currentRound.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'prompt_votes',
        filter: `round_id=eq.${currentRound.id}`
      }, () => {
        fetchPromptVotes();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRound?.id, room?.game_mode]);

  // Subscribe to image votes (voting mode only)
  useEffect(() => {
    if (!currentRound?.id || room?.game_mode !== 'voting') return;
    
    const fetchImageVotes = async () => {
      const { data } = await supabase
        .from('image_votes')
        .select('*')
        .eq('round_id', currentRound.id);
      if (data) setImageVotes(data as ImageVote[]);
    };

    fetchImageVotes();
    
    const channel = supabase
      .channel(`image-votes-${currentRound.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'image_votes',
        filter: `round_id=eq.${currentRound.id}`
      }, () => {
        fetchImageVotes();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRound?.id, room?.game_mode]);

  // Subscribe to forgery votes (forgery mode only)
  useEffect(() => {
    if (!currentRound?.id || room?.game_mode !== 'forgery') return;

    fetchForgeryVotes(currentRound.id);

    const channel = supabase
      .channel(`forgery-votes-${currentRound.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'forgery_votes',
        filter: `round_id=eq.${currentRound.id}`
      }, () => {
        fetchForgeryVotes(currentRound.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRound?.id, room?.game_mode]);

  // Fetch forger IDs when entering reveal state (needed for all clients)
  useEffect(() => {
    if (gameState !== 'forgery-reveal' || !currentRound?.id) return;

    const fetchForgerIds = async () => {
      const { data } = await supabase
        .from('player_round_prompts')
        .select('player_id')
        .eq('round_id', currentRound.id)
        .eq('is_forger', true);
      if (data) setForgeryForgerIds(data.map(r => r.player_id));
    };

    fetchForgerIds();
  }, [gameState, currentRound?.id]);

  // Fetch personal forgery prompt when submitting in forgery mode
  useEffect(() => {
    if (gameState !== 'submitting' || !currentRound?.id || room?.game_mode !== 'forgery' || isHost) return;
    fetchPlayerForgeryPrompt(currentRound.id);
  }, [gameState, currentRound?.id, room?.game_mode]);

  // Retry fetching winning submissions if winner-reveal state has no winner yet
  // (must be a top-level hook, not conditional on render branches below)
  useEffect(() => {
    if (gameState !== 'winner-reveal' || !currentRound) return;
    if (submissions.some(s => s.is_winner)) return;

    const retryFetch = async () => {
      console.log('Retrying to fetch winning submissions...');
      await fetchSubmissions(currentRound.id);
    };

    // Retry every 2 seconds for up to 10 seconds
    const retryInterval = setInterval(retryFetch, 2000);
    const timeout = setTimeout(() => {
      clearInterval(retryInterval);
      // If still no winners after 10 seconds, show error and go back to scoreboard
      if (!submissions.some(s => s.is_winner)) {
        toast({
          title: 'Error',
          description: 'Failed to load results. Moving to scoreboard.',
          variant: 'destructive'
        });
        setGameState('scoreboard');
      }
    }, 10000);

    return () => {
      clearInterval(retryInterval);
      clearTimeout(timeout);
    };
  }, [gameState, currentRound?.id]);

  // Host listens for judge's prompt selection broadcast
  useEffect(() => {
    if (!isHost || gameState !== 'round-start' || !roomId) return;
    
    const channel = supabase
      .channel(`room-${roomId}-judge-selection`)
      .on('broadcast', { event: 'prompt-selected' }, (payload) => {
        console.log('Host received judge prompt selection:', payload);
        const prompt = payload.payload?.prompt;
        if (prompt) {
          handleRoundContinue(prompt);
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isHost, gameState, roomId]);

  // Host listens for judge's winner selection broadcast
  useEffect(() => {
    if (!isHost || gameState !== 'judging' || !currentRound?.id) return;
    
    console.log('[Host] Setting up winner-selected listener for round:', currentRound.id);
    const channel = supabase
      .channel(`judge-viewing-${currentRound.id}`)
      .on('broadcast', { event: 'winner-selected' }, (payload) => {
        console.log('[Host] Received winner-selected broadcast:', payload);
        const submissionId = payload?.payload?.submissionId;
        if (submissionId) {
          handleSelectWinner(submissionId);
        }
      })
      .subscribe();
      
    return () => {
      console.log('[Host] Cleaning up winner-selected listener');
      supabase.removeChannel(channel);
    };
  }, [isHost, gameState, currentRound?.id]);

  const fetchPlayers = async () => {
    if (!roomId) return;
    const { data } = await supabase.from('players').select('*').eq('room_id', roomId);
    if (data) setPlayers(data);
  };

  const fetchRoom = async () => {
    // Only hosts (authenticated) can read from rooms due to RLS
    if (!roomId || !session) return;
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();
    if (data) {
      setRoom(data as Room);
      setRoomCode(data.code); // Also set room code for display
    }
  };

  const fetchCurrentRound = async () => {
    if (!roomId) return;
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('room_id', roomId)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching current round:', error);
      return;
    }
    
    if (data) {
      setCurrentRound(data as Round);
    }
  };

  const fetchSubmissions = async (roundId: string) => {
    try {
      console.log('=== FETCHING SUBMISSIONS ===');
      console.log('Round ID:', roundId);
      console.log('Room ID:', roomId);
      console.log('Player ID:', playerId);
      console.log('Is Host:', isHost);
      console.log('Auth User ID:', user?.id);
      
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('round_id', roundId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching submissions:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        logErrorInDev('fetchSubmissions', error);
        toast({ 
          title: 'Error loading submissions', 
          description: getUserFriendlyErrorMessage(error),
          variant: 'destructive' 
        });
      } else {
        console.log('✅ Submissions fetched successfully:', data?.length || 0, 'submissions');
        console.log('Submission details:', data);
        if (data) {
          setSubmissions(data);
          console.log('State updated with submissions');
        }
      }
      console.log('=== END FETCH ===');
    } catch (err) {
      console.error('❌ Exception in fetchSubmissions:', err);
      logErrorInDev('fetchSubmissions exception', err);
      toast({ 
        title: 'Error loading submissions', 
        description: 'Failed to load submissions. Please refresh and try again.',
        variant: 'destructive' 
      });
    }
  };

  const fetchHostRooms = async (userId: string) => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false });
    
    if (data && data.length > 0) {
      setHostRooms(data as Room[]);
      
      // Check if host has a stored room to restore
      const storedRoomId = localStorage.getItem('hostRoomId');
      const storedRoom = data.find(r => r.id === storedRoomId);
      
      if (storedRoom) {
        // Automatically restore to the last active room
        setRoomId(storedRoom.id);
        setRoomCode(storedRoom.code);
        await fetchPlayers();
        await fetchRoom();
        await fetchCurrentRound();
        
        if (storedRoom.status === 'waiting') {
          setGameState('lobby');
        }
        // Real-time subscriptions will handle the rest
      } else {
        setGameState('select-room');
      }
    } else {
      setHostRooms([]);
    }
  };

  const fetchForgeryVotes = async (roundId: string) => {
    const { data } = await supabase
      .from('forgery_votes')
      .select('voter_id, accused_player_id')
      .eq('round_id', roundId);
    if (data) setForgeryVotes(data as ForgeryVote[]);
  };

  const fetchPlayerForgeryPrompt = async (roundId: string) => {
    if (!playerId) return;
    const { data } = await supabase
      .from('player_round_prompts')
      .select('prompt_text')
      .eq('round_id', roundId)
      .eq('player_id', playerId)
      .maybeSingle();
    if (data) setPlayerForgeryPrompt(data.prompt_text);
  };

  const computeForgeryScoreChanges = (forgerIds: string[], votes: ForgeryVote[]): Record<string, number> => {
    const totalVotes = votes.length;
    const voteCounts: Record<string, number> = {};
    for (const vote of votes) {
      voteCounts[vote.accused_player_id] = (voteCounts[vote.accused_player_id] || 0) + 1;
    }
    const forgerCaught = forgerIds.some(fid => (voteCounts[fid] || 0) > totalVotes / 2);
    const scoreChanges: Record<string, number> = {};
    if (forgerCaught) {
      for (const vote of votes) {
        if (forgerIds.includes(vote.accused_player_id)) {
          scoreChanges[vote.voter_id] = (scoreChanges[vote.voter_id] || 0) + 1;
        }
      }
    } else {
      for (const fid of forgerIds) {
        scoreChanges[fid] = (scoreChanges[fid] || 0) + 2;
      }
    }
    return scoreChanges;
  };

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateRoom = async (gameMode: 'judge' | 'voting' | 'forgery' = 'judge') => {
    if (!user?.id) {
      toast({ title: 'Authentication required', description: 'Please log in to host a game', variant: 'destructive' });
      return;
    }

    try {
      console.log('User ID:', user.id);
      console.log('Creating room with game mode:', gameMode);
      
      // Check if host already has an active room
      const storedHostRoomId = localStorage.getItem('hostRoomId');
      if (storedHostRoomId) {
        const { data: activeRoom } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', storedHostRoomId)
          .eq('host_id', user.id)
          .maybeSingle();
        
        if (activeRoom && ['waiting', 'playing'].includes(activeRoom.status)) {
          console.log('Host already has active room, rejoining:', activeRoom.code);
          setRoomId(activeRoom.id);
          setRoomCode(activeRoom.code);
          setGameState(activeRoom.status === 'waiting' ? 'lobby' : 'lobby');
          return;
        } else {
          // Room no longer valid, clear it
          console.log('Stored room is no longer active, will create new one');
          localStorage.removeItem('hostRoomId');
        }
      }
      
      // Delete any old rooms for this user
      const { data: existingRooms, error: fetchError } = await supabase
        .from('rooms')
        .select('id')
        .eq('user_id', user.id);

      console.log('Existing rooms:', existingRooms);
      console.log('Fetch error:', fetchError);

      if (fetchError) {
        console.error('Error fetching existing rooms:', fetchError);
        // Continue anyway - don't block room creation if we can't fetch existing rooms
      } else if (existingRooms && existingRooms.length > 0) {
        console.log(`Deleting ${existingRooms.length} existing room(s)`);
        
        // Delete each existing room - try RPC first, fall back to direct delete
        for (const room of existingRooms) {
          console.log('Attempting to delete room:', room.id);
          
          // Try the database function first (handles cascades properly)
          const { error: rpcError } = await supabase.rpc('delete_ended_room', {
            p_room_id: room.id,
            p_caller_id: user.id
          });
          
          if (rpcError) {
            console.log('RPC delete failed, trying direct delete:', rpcError);
            
            // Fall back to direct delete (will work for rooms where user_id matches)
            const { error: directDeleteError } = await supabase
              .from('rooms')
              .delete()
              .eq('id', room.id)
              .eq('user_id', user.id);
            
            if (directDeleteError) {
              console.error('Direct delete also failed:', directDeleteError);
              // Continue anyway - don't block room creation
            } else {
              console.log('Successfully deleted room via direct delete:', room.id);
            }
          } else {
            console.log('Successfully deleted room via RPC:', room.id);
          }
        }
      }

      const code = generateRoomCode();
      
      console.log('Creating new room with code:', code);
      
      // Create room with authenticated user_id and game mode
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({ code, status: 'waiting', user_id: user.id, host_id: user.id, game_mode: gameMode })
        .select()
        .single();
      
      console.log('Room creation result:', { roomData, roomError });
      
      if (roomError || !roomData) {
        console.error('Room creation error:', roomError);
        const errorMessage = getUserFriendlyErrorMessage(roomError);
        toast({ title: 'Error creating room', description: errorMessage, variant: 'destructive' });
        return;
      }

      console.log('Room created successfully:', roomData);
      
      setRoomId(roomData.id);
      setRoomCode(code);
      
      // Store host's room in localStorage
      localStorage.setItem('hostRoomId', roomData.id);
      
      // Add URL parameter to persist host status
      window.history.replaceState({}, '', '/play?mode=host');
      
      // Refresh the host rooms list to clear old entries
      await fetchHostRooms(user.id);
      
      setGameState('lobby');
      fetchPlayers();
      fetchRoom();
    } catch (error) {
      console.error('Error in handleCreateRoom:', error);
      toast({ title: 'Error', description: 'Failed to create room', variant: 'destructive' });
    }
  };

  const handleJoinRoom = async (playerName: string, code: string) => {
    // Validate player name with comprehensive security checks
    let safeName: string;
    try {
      safeName = validatePlayerName(playerName);
    } catch (error) {
      if (error instanceof ZodError) {
        toast({
          title: 'Invalid Name',
          description: error.errors[0]?.message || 'Please enter a valid name',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Invalid Name',
          description: 'Please enter a valid name',
          variant: 'destructive',
        });
      }
      return;
    }

    const roomCodeUpper = code.toUpperCase().trim();

    // Lookup room by code via secure function (bypasses RLS safely for this specific query)
    const { data: roomRows, error: findError } = await supabase.rpc('find_room_by_code', {
      room_code: roomCodeUpper,
    });

    if (findError) {
      logErrorInDev('Error looking up room', findError);
      toast({
        title: 'Error joining game',
        description: getUserFriendlyErrorMessage(findError),
        variant: 'destructive',
      });
      return;
    }

    const roomData = Array.isArray(roomRows) ? roomRows[0] : roomRows;

    if (!roomData) {
      toast({ title: 'Room not found', description: 'Please check the room code and try again', variant: 'destructive' });
      return;
    }

    // First check if player already exists in this room with this name
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomData.id)
      .eq('name', safeName)
      .maybeSingle();

    let playerData;
    if (existingPlayer) {
      // Reuse existing player
      playerData = existingPlayer;
    } else {
      // Check max player limit before creating new player
      const { count: playerCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomData.id);
      
      if (playerCount !== null && playerCount >= 12) {
        toast({
          title: 'Room is full',
          description: 'This room has reached the maximum of 12 players',
          variant: 'destructive',
        });
        return;
      }
      
      // Create new player
      const { data: newPlayer, error } = await supabase
        .from('players')
        .insert({ room_id: roomData.id, name: safeName })
        .select()
        .single();

      if (error || !newPlayer) {
        logErrorInDev('Error creating player', error);
        toast({
          title: 'Error joining room',
          description: getUserFriendlyErrorMessage(error),
          variant: 'destructive',
        });
        return;
      }
      playerData = newPlayer;
    }

    setRoomId(roomData.id);
    setRoomCode(roomCodeUpper);
    setPlayerId(playerData.id);

    // Store session in localStorage for auto-rejoin
    localStorage.setItem('playerId', playerData.id);
    localStorage.setItem('roomId', roomData.id);
    localStorage.setItem('roomCode', roomCodeUpper);

    // Check if game is already in progress
    if (roomData.status === 'playing') {
      // Fetch current round to determine state
      const { data: roundData } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', roomData.id)
        .order('round_number', { ascending: false })
        .limit(1)
        .single();

      if (roundData) {
        setCurrentRound(roundData as Round);
        // Join mid-game - player will participate in next round
        if (roundData.status === 'submitting' || roundData.status === 'judging') {
          setGameState('submitting');
          toast({ 
            title: 'Joined mid-game', 
            description: 'You\'ll participate in the next round!' 
          });
        } else if (roundData.status === 'complete') {
          setGameState('scoreboard');
        } else {
          setGameState('lobby');
        }
      } else {
        setGameState('lobby');
      }
    } else {
      setGameState('lobby');
    }
    
    fetchPlayers();
    fetchRoom();
  };

  const handleStartGame = () => withGuard('startGame', async () => {
    if (!isHost || !roomId || !user) return;
    
    // Verify minimum 3 players for judge mode
    if (players.length < 3) {
      toast({
        title: 'Not enough players',
        description: 'Judge mode requires at least 3 players',
        variant: 'destructive'
      });
      return;
    }

    const firstJudge = players[0];
    
    // Update room status
    await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId);
    
    // Set first judge using secure function
    const { error: judgeError } = await supabase.rpc('set_round_judge', {
      p_room_id: roomId,
      p_judge_id: firstJudge.id,
      p_caller_id: user.id
    });

    if (judgeError) {
      console.error('Error setting judge:', judgeError);
      toast({ title: 'Error starting game', description: judgeError.message, variant: 'destructive' });
      return;
    }
    
    // Create first round
    const { data: roundData } = await supabase
      .from('rounds')
      .insert({ room_id: roomId, round_number: 1, judge_id: firstJudge.id, status: 'not_started' })
      .select()
      .single();

    if (roundData) {
      setCurrentRound(roundData as Round);
      setGameState('round-start');
    }
  });

  const handleRoundContinue = (selectedPrompt: string) => withGuard('roundContinue', async () => {
    if (!currentRound) return;
    
    // Only the host should update the database
    // Judge just updates their local UI (the broadcast handles notifying the host)
    if (!isHost) {
      return;
    }
    
    try {
      // Host performs the database update
      const { error } = await supabase
        .from('rounds')
        .update({ 
          prompt: selectedPrompt,
          status: 'submitting' 
        })
        .eq('id', currentRound.id);
        
      if (error) {
        console.error('Error updating round:', error);
        toast({
          title: 'Error',
          description: 'Failed to select prompt. Please try again.',
          variant: 'destructive'
        });
        return;
      }
      
      toast({
        title: 'Prompt Selected!',
        description: 'Waiting for players to submit images...',
      });
      
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error),
        variant: 'destructive'
      });
    }
  });

  const handleImageSubmit = async (file: File) => {
    console.log('🖼️ Starting image submission...');
    console.log('Player ID:', playerId);
    console.log('Round ID:', currentRound?.id);
    console.log('Room ID:', roomId);
    
    if (!currentRound || !roomId) {
      toast({
        title: "Error",
        description: "Missing game information. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    if (!playerId) {
      toast({
        title: "Error",
        description: "Player ID is missing. Please rejoin the game.",
        variant: "destructive",
      });
      console.error('❌ Cannot submit image: playerId is undefined');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Only JPEG, PNG, and WebP images are allowed.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "Image must be less than 5MB.",
        variant: "destructive",
      });
      return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${roomCode}/${currentRound.id}/${playerId}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('game-images').upload(fileName, file, {
      upsert: true
    });

    if (uploadError) {
      toast({ 
        title: 'Upload Failed', 
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive' 
      });
      console.error('Upload error:', uploadError);
      return;
    }

    const { data } = supabase.storage.from('game-images').getPublicUrl(fileName);

    const { error: insertError } = await supabase.from('submissions').insert({
      round_id: currentRound.id,
      player_id: playerId,
      image_url: data.publicUrl
    });

    if (insertError) {
      toast({ 
        title: 'Save Failed', 
        description: 'Failed to save submission. Please try again.',
        variant: 'destructive' 
      });
      console.error('Insert error:', insertError);
      return;
    }

    toast({
      title: "Success",
      description: "Image submitted successfully!",
    });

    fetchSubmissions(currentRound.id);
  };

  const handleStartJudging = () => withGuard('startJudging', async () => {
    if (!currentRound?.id) return;
    console.log('[Host] Start Judging pressed');
    await supabase.from('rounds').update({ status: 'judging' }).eq('id', currentRound.id);
    setCurrentRound(prev => prev ? { ...prev, status: 'judging' } : prev);
    toast({
      title: 'Judging Started',
      description: 'Judge can now review submissions',
    });
  });

  const handleSelectWinner = (submissionId: string) => withGuard('selectWinner', async () => {
    if (!currentRound) return;

    console.log('[Host] Selecting winner:', submissionId);
    const submission = submissions.find(s => s.id === submissionId);
    if (!submission) return;

    // Mark submission as winner
    await supabase.from('submissions').update({ is_winner: true }).eq('id', submissionId);

    // Update round status
    await supabase.from('rounds').update({ status: 'complete' }).eq('id', currentRound.id);

    // Increment winner's score using secure function
    const { error: scoreError } = await supabase.rpc('increment_player_score', {
      p_player_id: submission.player_id,
      p_round_id: currentRound.id
    });

    if (scoreError) {
      console.error('Error updating score:', scoreError);
      toast({ title: 'Error updating score', description: scoreError.message, variant: 'destructive' });
      return;
    }

    await fetchSubmissions(currentRound.id);
    await fetchPlayers();
    await fetchCurrentRound();
    setGameState('winner-reveal');
  });

  const handleNextRound = () => withGuard('nextRound', async () => {
    if (!isHost || !roomId || !currentRound || !user || !room) return;

    const nextRoundNumber = currentRound.round_number + 1;

    // Branch based on game mode
    if (room.game_mode === 'judge') {
      // JUDGE MODE: Rotate judge
      const currentJudgeIndex = players.findIndex(p => p.id === currentRound.judge_id);
      const nextJudgeIndex = (currentJudgeIndex + 1) % players.length;
      const nextJudge = players[nextJudgeIndex];

      const { error: judgeError } = await supabase.rpc('set_round_judge', {
        p_room_id: roomId,
        p_judge_id: nextJudge.id,
        p_caller_id: user.id
      });

      if (judgeError) {
        console.error('Error setting judge:', judgeError);
        toast({ title: 'Error starting next round', description: judgeError.message, variant: 'destructive' });
        return;
      }

      // Create round with judge
      const { data: roundData } = await supabase
        .from('rounds')
        .insert({ 
          room_id: roomId, 
          round_number: nextRoundNumber, 
          judge_id: nextJudge.id, 
          status: 'not_started' 
        })
        .select()
        .single();

      if (roundData) {
        setCurrentRound(roundData as Round);
        setSubmissions([]);
        setGameState('round-start');
      }
    } else if (room.game_mode === 'forgery') {
      // FORGERY MODE: Create round + assign forgery roles
      try {
        const { data: roundData, error: roundError } = await supabase
          .from('rounds')
          .insert({ room_id: roomId, round_number: nextRoundNumber, judge_id: null, status: 'not_started' })
          .select()
          .single();

        if (roundError) throw roundError;

        const { error: assignError } = await supabase.rpc('assign_forgery_roles', {
          p_round_id: roundData.id,
          p_room_id: roomId
        });

        if (assignError) throw assignError;

        setCurrentRound({ ...roundData, status: 'forgery-prompt-assigned' });
        setSubmissions([]);
        setForgeryVotes([]);
        setCurrentForgeryVote(null);
        setForgeryForgerIds([]);
        setForgeryScoreChanges({});
        setPlayerForgeryPrompt(null);
        setGameState('forgery-round-start');
      } catch (error: any) {
        console.error('Error creating next forgery round:', error);
        toast({ title: 'Error', description: getUserFriendlyErrorMessage(error), variant: 'destructive' });
      }
    } else {
      // VOTING MODE: Fetch prompts for new round
      try {
        // Fetch 4 random prompts
        const { data: promptsData, error: promptsError } = await supabase
          .from('prompts')
          .select('*')
          .limit(100);
          
        if (promptsError) throw promptsError;
        
        const shuffled = promptsData?.sort(() => 0.5 - Math.random()) || [];
        const selectedPrompts = shuffled.slice(0, 4).map(p => p.text);
        
        // Create round with prompts
        const { data: roundData, error: roundError } = await supabase
          .from('rounds')
          .insert({ 
            room_id: roomId, 
            round_number: nextRoundNumber, 
            judge_id: null,
            status: 'prompt-voting',
            selected_prompts: selectedPrompts
          })
          .select()
          .single();

        if (roundError) throw roundError;

        if (roundData) {
          setCurrentRound(roundData as Round);
          setSubmissions([]);
          setGameState('prompt-voting');
        }
      } catch (error: any) {
        console.error('Error creating next round:', error);
        toast({
          title: 'Error',
          description: getUserFriendlyErrorMessage(error),
          variant: 'destructive'
        });
      }
    }
  });

  const submissionsWithPlayerNames = submissions.map(sub => ({
    ...sub,
    player_name: players.find(p => p.id === sub.player_id)?.name || 'Unknown'
  }));

  const nonJudgePlayers = players.filter(p => p.id !== currentRound?.judge_id);
  const submittedCount = submissions.length;
  const totalSubmitters = nonJudgePlayers.length;

  const handleRemovePlayer = async (playerId: string) => {
    if (!isHost || !roomId) return;

    try {
      const playerToRemove = players.find(p => p.id === playerId);
      if (!playerToRemove) return;

      // Prevent removing last player if game started
      if (players.length === 1 && room?.status === 'playing') {
        toast({ 
          title: 'Cannot remove', 
          description: 'Cannot remove the last player during a game',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;

      // If removed player was the judge, reassign
      if (currentRound && currentRound.judge_id === playerId && players.length > 1) {
        const remainingPlayers = players.filter(p => p.id !== playerId);
        const newJudge = remainingPlayers[0];
        
        await supabase.rpc('set_round_judge', {
          p_room_id: roomId,
          p_judge_id: newJudge.id,
          p_caller_id: user!.id,
        });
      }

      toast({ 
        title: 'Player removed', 
        description: `${playerToRemove.name} has been removed from the game` 
      });
    } catch (error: any) {
      console.error('Remove player error:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setGameState('home');
    setRoomId('');
    setPlayerId('');
    // Clear all localStorage on logout
    localStorage.clear();
  };

  const handleEndGame = async () => {
    if (!isHost || !roomId || !user) return;

    try {
      // Step 1: Fetch all submission image URLs for this room
      const { data: roundsData } = await supabase
        .from('rounds')
        .select('id')
        .eq('room_id', roomId);

      if (roundsData && roundsData.length > 0) {
        const roundIds = roundsData.map(r => r.id);
        
        const { data: submissionsData } = await supabase
          .from('submissions')
          .select('image_url')
          .in('round_id', roundIds);

        // Step 2: Delete all images from storage
        if (submissionsData && submissionsData.length > 0) {
          const imagePaths = submissionsData
            .map(s => {
              const url = s.image_url;
              const match = url.match(/game-images\/(.+)$/);
              return match ? match[1] : null;
            })
            .filter(Boolean) as string[];

          if (imagePaths.length > 0) {
            const { error: storageError } = await supabase
              .storage
              .from('game-images')
              .remove(imagePaths);

            if (storageError) {
              logErrorInDev('Storage deletion error', storageError);
              // Continue anyway - don't block room deletion
            }
          }
        }
      }

      // Step 3: Call the database function to cascade delete all data
      const { error: deleteError } = await supabase
        .rpc('delete_ended_room', {
          p_room_id: roomId,
          p_caller_id: user.id
        });

      if (deleteError) throw deleteError;

      // Step 4: Clear local state
      setGameState('home');
      setRoomId('');
      setPlayerId('');
      setRoomCode('');
      // Only clear game-related localStorage, not auth session
      localStorage.removeItem('hostRoomId');
      localStorage.removeItem('playerSession');

      toast({ 
        title: 'Game ended', 
        description: 'The game and all related data have been cleaned up successfully' 
      });
    } catch (error: any) {
      logErrorInDev('End game error', error);
      toast({ 
        title: 'Error', 
        description: getUserFriendlyErrorMessage(error), 
        variant: 'destructive' 
      });
    }
  };

  const handleEndRoom = async (roomIdToEnd: string) => {
    if (!user) return;

    try {
      // Step 1: Fetch all submission image URLs for this room
      const { data: roundsData } = await supabase
        .from('rounds')
        .select('id')
        .eq('room_id', roomIdToEnd);

      if (roundsData && roundsData.length > 0) {
        const roundIds = roundsData.map(r => r.id);
        
        const { data: submissionsData } = await supabase
          .from('submissions')
          .select('image_url')
          .in('round_id', roundIds);

        // Step 2: Delete all images from storage
        if (submissionsData && submissionsData.length > 0) {
          const imagePaths = submissionsData
            .map(s => {
              const url = s.image_url;
              const match = url.match(/game-images\/(.+)$/);
              return match ? match[1] : null;
            })
            .filter(Boolean) as string[];

          if (imagePaths.length > 0) {
            const { error: storageError } = await supabase
              .storage
              .from('game-images')
              .remove(imagePaths);
            
            if (storageError) {
              logErrorInDev('Storage deletion error', storageError);
              // Continue anyway
            }
          }
        }
      }

      // Step 3: Call the database function to cascade delete all data
      const { error: deleteError } = await supabase
        .rpc('delete_ended_room', {
          p_room_id: roomIdToEnd,
          p_caller_id: user.id
        });

      if (deleteError) throw deleteError;

      // Step 4: Refresh the room list
      await fetchHostRooms(user.id);

      toast({ 
        title: 'Room closed', 
        description: 'The room and all related data have been cleaned up successfully' 
      });
    } catch (error: any) {
      logErrorInDev('End room error', error);
      toast({ 
        title: 'Error', 
        description: getUserFriendlyErrorMessage(error), 
        variant: 'destructive' 
      });
    }
  };

  const handleContinueRoom = async (roomIdToContinue: string) => {
    const selectedRoom = hostRooms.find(r => r.id === roomIdToContinue);
    if (!selectedRoom) return;

    setRoomId(selectedRoom.id);
    setRoomCode(selectedRoom.code);
    
    // Store host's room in localStorage for persistence
    localStorage.setItem('hostRoomId', selectedRoom.id);
    
    // Add URL parameter to persist host status
    window.history.replaceState({}, '', '/play?mode=host');
    
    // Fetch the room state and continue from where it left off
    await fetchPlayers();
    await fetchRoom();
    await fetchCurrentRound();

    if (selectedRoom.status === 'waiting') {
      setGameState('lobby');
    }
    // The real-time subscriptions and state sync will handle the rest
  };

  const handleCreateNewRoom = (gameMode: 'judge' | 'voting' | 'forgery' = 'judge') => {
    // Clear any old data
    localStorage.removeItem('hostRoomId');
    localStorage.removeItem('roomId');
    localStorage.removeItem('roomCode');
    localStorage.removeItem('gameSession');
    setHostRooms([]);
    handleCreateRoom(gameMode);
  };

  // ============= VOTING MODE HANDLERS =============

  const handleStartGameVoting = () => withGuard('startGameVoting', async () => {
    if (!isHost || !roomId || !user) return;
    
    try {
      // Verify minimum 3 players for voting mode
      if (players.length < 3) {
        toast({
          title: 'Not enough players',
          description: 'Voting mode requires at least 3 players',
          variant: 'destructive'
        });
        return;
      }
      
      // Fetch 4 random prompts
      const { data: promptsData, error: promptsError } = await supabase
        .from('prompts')
        .select('*')
        .limit(100);
        
      if (promptsError) throw promptsError;
      
      const shuffled = promptsData?.sort(() => 0.5 - Math.random()) || [];
      const selectedPrompts = shuffled.slice(0, 4).map(p => p.text);
      
      // Create first round
      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .insert({
          room_id: roomId,
          round_number: 1,
          judge_id: null,
          status: 'prompt-voting',
          selected_prompts: selectedPrompts
        })
        .select()
        .single();
        
      if (roundError) throw roundError;
      
      // Update room status
      await supabase
        .from('rooms')
        .update({ status: 'playing' })
        .eq('id', roomId);
        
      setCurrentRound(roundData as Round);
      setGameState('prompt-voting');
      
    } catch (error: any) {
      console.error('Start game error:', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error),
        variant: 'destructive'
      });
    }
  });

  // ============= FORGERY MODE HANDLERS =============

  const handleStartGameForgery = () => withGuard('startGameForgery', async () => {
    if (!isHost || !roomId || !user) return;

    if (players.length < 3) {
      toast({
        title: 'Not enough players',
        description: 'Forgery mode requires at least 3 players',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Create round
      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .insert({ room_id: roomId, round_number: 1, judge_id: null, status: 'not_started' })
        .select()
        .single();

      if (roundError) throw roundError;

      // Update room status
      await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId);

      // Assign forgery roles — also sets round status to 'forgery-prompt-assigned'
      const { error: assignError } = await supabase.rpc('assign_forgery_roles', {
        p_round_id: roundData.id,
        p_room_id: roomId
      });

      if (assignError) throw assignError;

      setCurrentRound({ ...roundData, status: 'forgery-prompt-assigned' });
      setGameState('forgery-round-start');

    } catch (error: any) {
      console.error('Start forgery game error:', error);
      toast({ title: 'Error', description: getUserFriendlyErrorMessage(error), variant: 'destructive' });
    }
  });

  const handleForgeryVote = async (accusedPlayerId: string) => {
    if (!playerId || !currentRound?.id) return;

    setCurrentForgeryVote(accusedPlayerId);

    try {
      const { error } = await supabase
        .from('forgery_votes')
        .upsert({
          round_id: currentRound.id,
          voter_id: playerId,
          accused_player_id: accusedPlayerId
        }, { onConflict: 'round_id,voter_id' });

      if (error) throw error;
    } catch (error: any) {
      console.error('Forgery vote error:', error);
      toast({ title: 'Error', description: getUserFriendlyErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleEndForgeryVoting = () => withGuard('endForgeryVoting', async () => {
    if (!isHost || !currentRound?.id) return;

    try {
      // Fetch forger IDs
      const { data: promptData } = await supabase
        .from('player_round_prompts')
        .select('player_id')
        .eq('round_id', currentRound.id)
        .eq('is_forger', true);

      const forgerIds = promptData?.map(r => r.player_id) || [];
      setForgeryForgerIds(forgerIds);

      // Compute score changes
      const scoreChanges = computeForgeryScoreChanges(forgerIds, forgeryVotes);
      setForgeryScoreChanges(scoreChanges);

      // Apply score changes (increment_player_score adds 1 per call)
      for (const [pid, delta] of Object.entries(scoreChanges)) {
        for (let i = 0; i < delta; i++) {
          await supabase.rpc('increment_player_score', {
            p_player_id: pid,
            p_round_id: currentRound.id
          });
        }
      }

      await fetchPlayers();

      // Transition everyone to reveal via round status
      await supabase.from('rounds').update({ status: 'forgery-reveal' }).eq('id', currentRound.id);

      setGameState('forgery-reveal');

    } catch (error: any) {
      console.error('End forgery voting error:', error);
      toast({ title: 'Error', description: getUserFriendlyErrorMessage(error), variant: 'destructive' });
    }
  });

  // ============= END FORGERY MODE HANDLERS =============

  const handlePromptVote = async (promptText: string) => {
    if (!playerId || !currentRound?.id) return;
    
    setCurrentPromptVote(promptText);
    
    try {
      const { error } = await supabase
        .from('prompt_votes')
        .upsert({
          round_id: currentRound.id,
          player_id: playerId,
          prompt_text: promptText
        }, {
          onConflict: 'round_id,player_id'
        });
        
      if (error) throw error;
    } catch (error: any) {
      console.error('Prompt vote error:', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error),
        variant: 'destructive'
      });
    }
  };

  const handlePromptVotingComplete = () => withGuard('promptVotingComplete', async () => {
    if (!isHost || !currentRound?.id) return;
    
    try {
      // Calculate vote counts
      const voteCounts: Record<string, number> = {};
      promptVotes.forEach(vote => {
        voteCounts[vote.prompt_text] = (voteCounts[vote.prompt_text] || 0) + 1;
      });
      
      const maxVotes = Math.max(...Object.values(voteCounts));
      const winners = Object.keys(voteCounts).filter(p => voteCounts[p] === maxVotes);
      
      // Check for tie
      if (winners.length > 1 && !isRevoting) {
        // Initiate revote
        setIsRevoting(true);
        setTiedPrompts(winners);
        
        // Clear existing votes
        await supabase
          .from('prompt_votes')
          .delete()
          .eq('round_id', currentRound.id);
          
        setPromptVotes([]);
        setCurrentPromptVote(null);
        
        toast({
          title: 'Tie!',
          description: 'Revoting with tied prompts...'
        });
        return;
      }
      
      // We have a winner (or still tied after revote)
      const winningPrompt = winners[Math.floor(Math.random() * winners.length)];
      
      // Update round with winning prompt
      await supabase
        .from('rounds')
        .update({
          prompt: winningPrompt,
          status: 'submitting'
        })
        .eq('id', currentRound.id);
        
      setGameState('submitting');
      setIsRevoting(false);
      setTiedPrompts([]);
      
    } catch (error: any) {
      console.error('Complete prompt voting error:', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error),
        variant: 'destructive'
      });
    }
  });

  const handleStartPresentation = () => withGuard('startPresentation', async () => {
    if (!isHost || !currentRound?.id) return;
    
    try {
      // Determine which submissions to present
      const submissionsToPresent = tiedImageIds.length > 0
        ? submissions.filter(s => tiedImageIds.includes(s.id))
        : submissions;
      
      // Randomize submission order
      const shuffled = [...submissionsToPresent].sort(() => 0.5 - Math.random());
      const presentationOrder = shuffled.map(s => s.id);
      
      // Update round with presentation order and status
      await supabase
        .from('rounds')
        .update({ 
          status: 'presenting',
          presentation_order: presentationOrder
        })
        .eq('id', currentRound.id);
        
      setSubmissions(shuffled);
      setPresentationIndex(0);
      setGameState('presenting');
      
    } catch (error: any) {
      console.error('Start presentation error:', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error),
        variant: 'destructive'
      });
    }
  });

  const handleStartImageVoting = () => withGuard('startImageVoting', async () => {
    if (!isHost || !currentRound?.id) return;
    
    try {
      await supabase
        .from('rounds')
        .update({ status: 'image-voting' })
        .eq('id', currentRound.id);
        
      setGameState('image-voting');
      
    } catch (error: any) {
      console.error('Start image voting error:', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error),
        variant: 'destructive'
      });
    }
  });

  const handleImageVote = async (submissionId: string) => {
    if (!playerId || !currentRound?.id) return;
    
    setCurrentImageVote(submissionId);
    
    try {
      const { error } = await supabase
        .from('image_votes')
        .upsert({
          round_id: currentRound.id,
          voter_id: playerId,
          submission_id: submissionId
        }, {
          onConflict: 'round_id,voter_id'
        });
        
      if (error) {
        if (error.message.includes('Cannot vote for your own submission')) {
          toast({
            title: 'Invalid Vote',
            description: "You can't vote for your own submission",
            variant: 'destructive'
          });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Image vote error:', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error),
        variant: 'destructive'
      });
    }
  };

  const handleImageVotingComplete = () => withGuard('imageVotingComplete', async () => {
    if (!isHost || !currentRound?.id) return;
    
    // Check if there are any votes
    if (imageVotes.length === 0) {
      setShowNoVotesAlert(true);
      return;
    }
    
    try {
      // Calculate vote counts
      const voteCounts: Record<string, number> = {};
      imageVotes.forEach(vote => {
        voteCounts[vote.submission_id] = (voteCounts[vote.submission_id] || 0) + 1;
      });
      
      const maxVotes = Math.max(...Object.values(voteCounts));
      const winnerIds = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
      
      // CHECK FOR TIE
      if (winnerIds.length > 1 && !isRevotingImages) {
        console.log('🔄 Tie detected, initiating revote with tied images:', winnerIds);
        
        // Clear existing image votes
        await supabase
          .from('image_votes')
          .delete()
          .eq('round_id', currentRound.id);
        
        // Set revoting state
        setIsRevotingImages(true);
        setTiedImageIds(winnerIds);
        setImageVotes([]);
        setCurrentImageVote(null);
        
        toast({
          title: '🔄 Tie!',
          description: `${winnerIds.length} images are tied. Revoting with tied images...`
        });
        
        // Return to presenting state with only tied images
        setPresentationIndex(0);
        await handleStartPresentation();
        return;
      }
      
      // We have a winner (or still tied after revote)
      // If still tied after revote, pick randomly
      const finalWinnerId = winnerIds.length > 1 
        ? winnerIds[Math.floor(Math.random() * winnerIds.length)]
        : winnerIds[0];
      
      console.log('🏆 Final winner determined:', finalWinnerId);
      if (winnerIds.length > 1) {
        toast({
          title: '🎲 Still Tied!',
          description: 'Winner selected randomly from tied images.'
        });
      }
      
      // Mark winning submission
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ is_winner: true })
        .eq('id', finalWinnerId);
        
      if (updateError) {
        console.error('Failed to mark winner:', updateError);
        throw updateError;
      }
        
      // Update round
      const { error: roundError } = await supabase
        .from('rounds')
        .update({
          status: 'complete',
          winning_submission_ids: [finalWinnerId]
        })
        .eq('id', currentRound.id);
        
      if (roundError) {
        console.error('Failed to update round:', roundError);
        throw roundError;
      }
        
      // Increment score for winner
      const winningSubmission = submissions.find(s => s.id === finalWinnerId);
      if (winningSubmission) {
        const { error: scoreError } = await supabase.rpc('increment_player_score', {
          p_player_id: winningSubmission.player_id,
          p_round_id: currentRound.id
        });
        
        if (scoreError) {
          console.error('Error updating score:', scoreError);
        }
      }

      // WAIT for fresh data before transitioning
      await fetchPlayers();
      await fetchSubmissions(currentRound.id);
      
      // Verify we have winner in local state before transitioning
      const updatedSubmissions = await supabase
        .from('submissions')
        .select('*')
        .eq('round_id', currentRound.id)
        .eq('is_winner', true);
      
      if (updatedSubmissions.data && updatedSubmissions.data.length > 0) {
        // Update local state with verified winner data
        setSubmissions(prevSubmissions => 
          prevSubmissions.map(sub => ({
            ...sub,
            is_winner: sub.id === finalWinnerId
          }))
        );
        
        // Reset revoting state
        setIsRevotingImages(false);
        setTiedImageIds([]);
        
        // NOW transition to winner reveal
        setGameState('winner-reveal');
      } else {
        throw new Error('Failed to verify winning submission');
      }
      
    } catch (error: any) {
      console.error('Complete image voting error:', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error),
        variant: 'destructive'
      });
    }
  });

  const calculatePromptVoteCounts = (): Record<string, number> => {
    const counts: Record<string, number> = {};
    promptVotes.forEach(vote => {
      counts[vote.prompt_text] = (counts[vote.prompt_text] || 0) + 1;
    });
    return counts;
  };

  // ============= END VOTING MODE HANDLERS =============

  // Show loading state during initialization
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  // Only redirect if initialization is complete and no active game AND no code in URL
  const redirectUrlParams = new URLSearchParams(window.location.search);
  const redirectCodeFromUrl = redirectUrlParams.get('code');
  
  if (!isInitializing && gameState === 'home' && !redirectCodeFromUrl) {
    navigate('/', { replace: true });
    return null;
  }

  if (!isInitializing && gameState === 'select-room' && !redirectCodeFromUrl) {
    navigate('/', { replace: true });
    return null;
  }

  if (gameState === 'lobby') {
    const startHandler = room?.game_mode === 'voting'
      ? handleStartGameVoting
      : room?.game_mode === 'forgery'
        ? handleStartGameForgery
        : handleStartGame;
    return (
      <>
        {isHost && (
          <Button
            onClick={handleEndGame}
            variant="destructive"
            size="sm"
            className="fixed top-4 left-4 z-50 shadow-lg"
          >
            End Game
          </Button>
        )}
        <Lobby
          roomCode={roomCode}
          roomId={roomId}
          players={players}
          isHost={isHost}
          currentPlayerId={playerId || undefined}
          onStartGame={startHandler}
          onRemovePlayer={handleRemovePlayer}
          onAvatarUpdated={(pid, url) => {
            setPlayers(prev => prev.map(p => p.id === pid ? { ...p, avatar_url: url } : p));
          }}
          gameMode={room?.game_mode || 'judge'}
        />
      </>
    );
  }

  if (gameState === 'prompt-voting' && currentRound) {
    const prompts = isRevoting ? tiedPrompts : (currentRound.selected_prompts || []);
    
    // Safety check: if no prompts, show error to host
    if (prompts.length === 0 && isHost) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md p-6 space-y-4">
            <h2 className="text-2xl font-bold text-destructive">Error: No Prompts</h2>
            <p className="text-muted-foreground">
              No prompts were loaded for this round. This is a system error.
            </p>
            <Button onClick={handleEndGame} variant="destructive">
              End Game
            </Button>
          </Card>
        </div>
      );
    }
    
    if (isHost) {
      return (
        <>
          <Button
            onClick={handleEndGame}
            variant="destructive"
            size="sm"
            className="fixed top-4 left-4 z-50 shadow-lg"
          >
            End Game
          </Button>
          <HostPromptVoting roundNumber={currentRound.round_number} prompts={prompts} votes={promptVotes} players={players} onSkip={handlePromptVotingComplete} />
        </>
      );
    }
    return <PromptVoting roundNumber={currentRound.round_number} prompts={prompts} currentVote={currentPromptVote} voteCounts={calculatePromptVoteCounts()} onVote={handlePromptVote} totalPlayers={players.length} votedPlayers={promptVotes.length} />;
  }

  if (gameState === 'presenting' && currentRound) {
    if (isHost) {
      return (
        <>
          <Button
            onClick={handleEndGame}
            variant="destructive"
            size="sm"
            className="fixed top-4 left-4 z-50 shadow-lg"
          >
            End Game
          </Button>
          <HostImagePresentation submissions={submissions} currentIndex={presentationIndex} onNext={() => setPresentationIndex(i => Math.min(i + 1, submissions.length - 1))} onPrevious={() => setPresentationIndex(i => Math.max(i - 1, 0))} onStartVoting={handleStartImageVoting} tiedImageIds={tiedImageIds} />
        </>
      );
    }
    return <ImagePresentation roundNumber={currentRound.round_number} tiedImageIds={tiedImageIds} />;
  }

  if (gameState === 'image-voting' && currentRound) {
    if (isHost) {
      return (
        <>
          <Button
            onClick={handleEndGame}
            variant="destructive"
            size="sm"
            className="fixed top-4 left-4 z-50 shadow-lg"
          >
            End Game
          </Button>
          <HostImageVoting 
            submissions={submissions} 
            votes={imageVotes} 
            players={players} 
            onSkip={handleImageVotingComplete} 
            presentationOrder={currentRound.presentation_order || []}
            tiedImageIds={tiedImageIds}
          />
        </>
      );
    }
    return <ImageVoting submissions={submissions} currentVote={currentImageVote} votes={imageVotes} players={players} currentPlayerId={playerId} onVote={handleImageVote} presentationOrder={currentRound.presentation_order || []} tiedImageIds={tiedImageIds} />;
  }

  if (gameState === 'round-start' && currentRound) {
    return (
      <>
        {isHost && (
          <Button
            onClick={handleEndGame}
            variant="destructive"
            size="sm"
            className="fixed top-4 left-4 z-50 shadow-lg"
          >
            End Game
          </Button>
        )}
        <RoundStart
          roundNumber={currentRound.round_number}
          judgeName={judgePlayer?.name || ''}
          isJudge={isJudge}
          roomId={roomId}
          roundId={currentRound.id}
          onContinue={handleRoundContinue}
        />
      </>
    );
  }

  if (gameState === 'submitting' && currentRound) {
    // Host sees image gallery with submission progress
    if (isHost) {
      const isVotingMode = room?.game_mode === 'voting';
      const isForgeryModeHost = room?.game_mode === 'forgery';
      const onStartHandler = isForgeryModeHost
        ? async () => {
            await supabase.from('rounds').update({ status: 'forgery-voting' }).eq('id', currentRound.id);
          }
        : isVotingMode
          ? handleStartPresentation
          : handleStartJudging;
      return (
        <>
          <Button
            onClick={handleEndGame}
            variant="destructive"
            size="sm"
            className="fixed top-4 left-4 z-50 shadow-lg"
          >
            End Game
          </Button>
          <HostImageGallery
            submissions={submissionsWithPlayerNames}
            submittedCount={submittedCount}
            totalPlayers={totalSubmitters}
            roundId={currentRound.id}
            roomCode={roomCode}
            prompt={currentRound.prompt || undefined}
            onStartJudging={onStartHandler}
            onEndGame={handleEndGame}
          />
        </>
      );
    }
    
    // Judge waits until all submissions are in
    if (isJudge) {
      return (
        <JudgeWaitingView
          submittedCount={submittedCount}
          totalPlayers={totalSubmitters}
        />
      );
    }
    
    // Non-host, non-judge players submit images
    const isForgeryMode = room?.game_mode === 'forgery';
    const promptToShow = isForgeryMode
      ? (playerForgeryPrompt || currentRound.prompt || '')
      : (currentRound.prompt || '');

    return (
      <ImageSubmission
        onSubmit={handleImageSubmit}
        playersSubmitted={submittedCount}
        totalPlayers={totalSubmitters}
        prompt={promptToShow}
        roomId={roomId}
        hostId={room?.host_id || undefined}
      />
    );
  }

  // Show loading state if we're waiting for session restoration
  if (gameState === 'judging' && !user && storedHostRoomId === roomId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Loading...</h1>
          <p className="text-muted-foreground">Restoring your session</p>
        </div>
      </div>
    );
  }

  if (gameState === 'judging' && currentRound) {
    // Judge sees the judging interface
    if (isJudge) {
      return <JudgeView submissions={submissionsWithPlayerNames} onSelectWinner={handleSelectWinner} roundId={currentRound.id} />;
    }
    
    // Host sees synchronized gallery view
    if (isHost) {
      const winningSubmission = submissions.find(s => s.is_winner);
      return (
        <>
          <Button
            onClick={handleEndGame}
            variant="destructive"
            size="sm"
            className="fixed top-4 left-4 z-50 shadow-lg"
          >
            End Game
          </Button>
          <HostImageGallery
            submissions={submissionsWithPlayerNames}
            submittedCount={submittedCount}
            totalPlayers={totalSubmitters}
            roundId={currentRound.id}
            roomCode={roomCode}
            winnerId={winningSubmission?.id}
            prompt={currentRound.prompt || undefined}
            onNextRound={handleNextRound}
          />
        </>
      );
    }
    
    // Regular players see simple waiting screen
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-8 text-center">
          <h1 className="text-5xl font-bold text-foreground">Judging in Progress</h1>
          <p className="text-2xl text-muted-foreground">
            The judge is reviewing submissions and selecting a winner...
          </p>
        </div>
      </div>
    );
  }

  if (gameState === 'winner-reveal' && currentRound) {
    const winningSubmissions = submissions.filter(s => s.is_winner);
    
    if (winningSubmissions.length > 0) {
      const winners = winningSubmissions.map(sub => {
        const player = players.find(p => p.id === sub.player_id);
        return {
          submission: sub,
          playerName: player?.name || 'Unknown Player'
        };
      });
      
      return (
        <WinnerReveal
          winningSubmission={winners[0].submission}
          winnerName={winners[0].playerName}
          prompt={currentRound.prompt || ''}
          isHost={isHost}
          onContinue={() => setGameState('scoreboard')}
          additionalWinners={winners.length > 1 ? winners.slice(1) : undefined}
        />
      );
    }
    
    // Fallback: the top-level retry-fetch effect (above) will keep polling
    // for the winner and eventually redirect to scoreboard if none appears.
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-xl text-muted-foreground">Calculating results...</p>
        </div>
      </div>
    );
  }

  if (gameState === 'scoreboard' && currentRound) {
    if (room?.game_mode === 'voting') {
      const winningSubmissions = submissions.filter(s => s.is_winner);
      return (
        <Scoreboard
          players={players}
          winnerIds={winningSubmissions.map(s => s.player_id)}
          prompt={currentRound.prompt || ''}
          gameMode="voting"
          isHost={isHost}
          onNextRound={handleNextRound}
          onEndGame={handleEndGame}
        />
      );
    }

    if (room?.game_mode === 'forgery') {
      return (
        <Scoreboard
          players={players}
          winnerIds={forgeryForgerIds}
          prompt={currentRound.prompt || ''}
          gameMode="voting"
          isHost={isHost}
          onNextRound={handleNextRound}
          onEndGame={handleEndGame}
        />
      );
    }
    
    const winningSubmission = submissions.find(s => s.is_winner);
    const winner = winningSubmission ? players.find(p => p.id === winningSubmission.player_id) : null;
    const nextJudge = winner || players[0];
    
    return (
      <Scoreboard
        players={players}
        winnerId={winner?.id || ''}
        winnerName={winner?.name || ''}
        nextJudgeName={nextJudge?.name || ''}
        gameMode="judge"
        isHost={isHost}
        onNextRound={handleNextRound}
        onEndGame={handleEndGame}
      />
    );
  }

  if (gameState === 'forgery-round-start' && currentRound) {
    return (
      <>
        {isHost && (
          <Button onClick={handleEndGame} variant="destructive" size="sm" className="fixed top-4 left-4 z-50 shadow-lg">
            End Game
          </Button>
        )}
        <ForgeryRoundStart
          roundId={currentRound.id}
          playerId={playerId}
          isHost={isHost}
          playerCount={players.length}
          roundNumber={currentRound.round_number}
          onHostStart={async () => {
            await supabase.from('rounds').update({ status: 'submitting' }).eq('id', currentRound.id);
          }}
        />
      </>
    );
  }

  if (gameState === 'forgery-voting' && currentRound) {
    if (isHost) {
      return (
        <>
          <Button onClick={handleEndGame} variant="destructive" size="sm" className="fixed top-4 left-4 z-50 shadow-lg">
            End Game
          </Button>
          <HostForgeryVoting
            players={players}
            votes={forgeryVotes}
            onEndVoting={handleEndForgeryVoting}
          />
        </>
      );
    }
    return (
      <ForgeryVoting
        players={players}
        submissions={submissions}
        currentPlayerId={playerId}
        currentVote={currentForgeryVote}
        onVote={handleForgeryVote}
      />
    );
  }

  if (gameState === 'forgery-reveal' && currentRound) {
    const revealScoreChanges = Object.keys(forgeryScoreChanges).length > 0
      ? forgeryScoreChanges
      : computeForgeryScoreChanges(forgeryForgerIds, forgeryVotes);

    return (
      <ForgeryReveal
        players={players}
        forgerIds={forgeryForgerIds}
        votes={forgeryVotes}
        mainPrompt={currentRound.prompt || ''}
        forgerPrompt={currentRound.selected_prompts?.[1] || ''}
        scoreChanges={revealScoreChanges}
        isHost={isHost}
        onContinue={async () => {
          if (isHost) {
            await supabase.from('rounds').update({ status: 'complete' }).eq('id', currentRound.id);
          }
          setGameState('scoreboard');
        }}
      />
    );
  }

  if (gameState === 'game-ended') {
    const handleLeave = () => {
      localStorage.clear();
      navigate('/');
    };
    return <GameEndedScreen players={players} onLeave={handleLeave} />;
  }

  return (
    <>
      {/* No Votes Alert Dialog */}
      <AlertDialog open={showNoVotesAlert} onOpenChange={setShowNoVotesAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Votes Cast</AlertDialogTitle>
            <AlertDialogDescription>
              Looks like no one voted yet. Would you like to end the game or keep waiting for votes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Waiting</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowNoVotesAlert(false);
                handleEndGame();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              End Game
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Index;
