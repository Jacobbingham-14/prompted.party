import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validatePlayerName } from '@/lib/validation';
import { normalizeRoomCode } from '@/lib/roomCode';
import { findRoomByCode } from '@/lib/roomLookup';
import { getUserFriendlyErrorMessage, logErrorInDev } from '@/lib/errorUtils';

export default function Join() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Get room code from URL parameter
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      setRoomCode(normalizeRoomCode(codeFromUrl));
    }
  }, [searchParams]);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your name',
        variant: 'destructive'
      });
      return;
    }

    if (!roomCode.trim()) {
      toast({
        title: 'Error',
        description: 'Room code is required',
        variant: 'destructive'
      });
      return;
    }

    setIsJoining(true);

    try {
      // Validate player name
      const validatedName = validatePlayerName(playerName);

      // Find room
      const { room, code: normalizedCode } = await findRoomByCode(roomCode);

      if (!room) {
        toast({
          title: 'Error',
          description: 'Room not found',
          variant: 'destructive'
        });
        setIsJoining(false);
        return;
      }

      if (room.status !== 'waiting' && room.status !== 'playing') {
        toast({
          title: 'Error',
          description: 'This room is no longer active',
          variant: 'destructive'
        });
        setIsJoining(false);
        return;
      }

      // Reuse an existing player row with this (case-insensitive) name
      // so rejoining after a refresh/tab-close lands you back in your seat.
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', room.id)
        .ilike('name', validatedName)
        .maybeSingle();

      let player = existingPlayer;

      if (!player) {
        const { data: created, error } = await supabase
          .from('players')
          .insert({
            room_id: room.id,
            name: validatedName,
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
            setIsJoining(false);
            return;
          }
          throw error;
        }
        player = created;
      }

      // Store game session (matching Index.tsx format)
      localStorage.setItem('playerId', player.id);
      localStorage.setItem('roomId', room.id);
      localStorage.setItem('roomCode', normalizedCode);

      // Navigate to game with state to avoid race condition
      navigate('/play', {
        state: {
          playerId: player.id,
          roomId: room.id,
          roomCode: normalizedCode
        }
      });
    } catch (error) {
      logErrorInDev('Join room error', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error),
        variant: 'destructive'
      });
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md animate-px-hop-in">
        <CardHeader className="text-center space-y-4">
          <p className="font-retro text-lg uppercase tracking-widest text-gal-teal">★ prompted.party ★</p>
          <CardTitle className="font-pixel text-base md:text-lg leading-relaxed">
            SIGN THE<br /><span className="text-gal-gold">GUEST BOOK</span>
          </CardTitle>
          {roomCode && (
            <div className="flex justify-center gap-1.5" aria-label={`Room code ${roomCode}`}>
              {roomCode.split('').map((ch, i) => (
                <span key={i} className="plaque inline-flex h-10 w-10 items-center justify-center text-sm">
                  {ch}
                </span>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoinRoom} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="name" className="font-pixel text-[9px] text-gal-teal">
                YOUR ARTIST NAME
              </label>
              <Input
                id="name"
                type="text"
                placeholder="e.g. Vincent van No"
                className="font-retro h-12 rounded-none border-[3px] border-ink text-2xl"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={50}
                autoFocus
                disabled={isJoining}
              />
            </div>

            {!roomCode && (
              <div className="space-y-2">
                <label htmlFor="code" className="font-pixel text-[9px] text-gal-teal">
                  ROOM CODE
                </label>
                <Input
                  id="code"
                  type="text"
                  placeholder="ABC123"
                  className="font-retro h-12 rounded-none border-[3px] border-ink text-2xl uppercase tracking-[0.3em]"
                  value={roomCode}
                  onChange={(e) => setRoomCode(normalizeRoomCode(e.target.value))}
                  maxLength={6}
                  disabled={isJoining}
                />
              </div>
            )}

            <Button
              type="submit"
              className="h-14 w-full"
              size="lg"
              disabled={isJoining || !playerName.trim() || !roomCode.trim()}
            >
              {isJoining ? 'Entering…' : 'Enter the gallery'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/')}
              disabled={isJoining}
            >
              Back to home
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
