import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validatePlayerName } from '@/lib/validation';
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
      setRoomCode(codeFromUrl.toUpperCase());
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
      const { data: roomRows } = await supabase.rpc('find_room_by_code', {
        room_code: roomCode.toUpperCase()
      });
      const room = Array.isArray(roomRows) ? roomRows[0] : roomRows;

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

      // Create player
      const { data: player, error } = await supabase
        .from('players')
        .insert({
          room_id: room.id,
          name: validatedName,
          score: 0
        })
        .select()
        .single();

      if (error) throw error;

      // Store game session (matching Index.tsx format)
      localStorage.setItem('playerId', player.id);
      localStorage.setItem('roomId', room.id);
      localStorage.setItem('roomCode', roomCode.toUpperCase());

      // Navigate to game with state to avoid race condition
      navigate('/play', {
        state: {
          playerId: player.id,
          roomId: room.id,
          roomCode: roomCode.toUpperCase()
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" />
            <CardTitle className="text-3xl font-bold">Join Game</CardTitle>
          </div>
          {roomCode && (
            <Badge variant="secondary" className="text-lg py-2 px-4">
              Room Code: {roomCode}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Your Name
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={50}
                autoFocus
                disabled={isJoining}
              />
            </div>

            {!roomCode && (
              <div className="space-y-2">
                <label htmlFor="code" className="text-sm font-medium">
                  Room Code
                </label>
                <Input
                  id="code"
                  type="text"
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  disabled={isJoining}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isJoining || !playerName.trim() || !roomCode.trim()}
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/')}
              disabled={isJoining}
            >
              Back to Home
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
