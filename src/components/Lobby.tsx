import { Button } from '@/components/ui/button';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { AvatarCreator } from '@/components/AvatarCreator';

interface Player {
  id: string;
  name: string;
  score: number;
  avatar_url?: string | null;
}

interface LobbyProps {
  roomCode: string;
  roomId: string;
  players: Player[];
  isHost: boolean;
  currentPlayerId?: string;
  onStartGame: () => void;
  onRemovePlayer?: (playerId: string) => void;
  onAvatarUpdated?: (playerId: string, url: string) => void;
  gameMode: 'judge' | 'voting' | 'forgery' | 'duel';
}

export default function Lobby({ roomCode, roomId, players, isHost, currentPlayerId, onStartGame, onRemovePlayer, onAvatarUpdated, gameMode }: LobbyProps) {
  const [origin, setOrigin] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Avoid SSR window access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const joinUrl = useMemo(() => {
    if (!origin) return '';
    return `${origin}/join?code=${roomCode}`;
  }, [origin, roomCode]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
    } catch {}
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my game',
          text: 'Scan or tap to join the game:',
          url: joinUrl,
        });
      } else {
        await copyLink();
      }
    } catch {}
  };

  const downloadQrPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `join-${roomCode}.png`;
    a.click();
  };

  const shareQrImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `join-${roomCode}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Join my game',
          text: 'Scan this to join!',
          files: [file],
        });
      } else {
        downloadQrPng();
      }
    } catch {
      downloadQrPng();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-3">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Room Code</h1>
          
          {/* Game Mode Description */}
          <div className="px-4 py-2 rounded-lg bg-muted/50 border border-border max-w-md mx-auto">
            <p className="text-sm text-muted-foreground text-center">
              {gameMode === 'judge' ? (
                <>
                  <span className="font-semibold text-foreground">Judge Mode:</span> One player will judge each round and pick the winner (3+ players required)
                </>
              ) : gameMode === 'forgery' ? (
                <>
                  <span className="font-semibold text-foreground">Forgery Mode:</span> One player gets a different secret prompt - spot the forger (3+ players required)
                </>
              ) : gameMode === 'duel' ? (
                <>
                  <span className="font-semibold text-foreground">Prompt Duel:</span> Head-to-head matchups over 3 rounds - vote for the funnier answer (3+ players required)
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">Voting Mode:</span> All players vote on submissions - most votes wins (3+ players required)
                </>
              )}
            </p>
          </div>

          <p className="text-4xl sm:text-5xl font-bold tracking-widest text-foreground border-4 border-border p-4 rounded-lg bg-muted">
            {roomCode}
          </p>

          {isHost && (
            <div className="flex flex-col items-center gap-3">
              <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={copyLink} disabled={!joinUrl}>
                  Copy Join Link
                </Button>
                <Button variant="secondary" onClick={shareLink} disabled={!joinUrl}>
                  Share Link
                </Button>
                <Button variant="default" onClick={shareQrImage} disabled={!joinUrl}>
                  Share QR Image
                </Button>
              </div>

              <div className="bg-white p-4 rounded-lg flex flex-col items-center">
                <QRCodeCanvas
                  value={joinUrl || 'about:blank'}
                  size={180}
                  includeMargin
                  // @ts-ignore
                  ref={canvasRef}
                />
                <p className="text-xs text-center mt-2 text-muted-foreground">Scan to join game</p>
                <Button variant="ghost" size="sm" className="mt-1" onClick={downloadQrPng}>
                  Download PNG
                </Button>
              </div>
            </div>
          )}
        </div>

        {isHost ? (
          <div className="space-y-2">
            <Button onClick={onStartGame} disabled={players.length < 3} className="w-full h-12 text-lg">
              Start Game
            </Button>
            {players.length < 3 && (
              <p className="text-center text-sm text-muted-foreground">
                Waiting for players ({players.length}/3 minimum)
              </p>
            )}
            {players.length >= 3 && (
              <p className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                Ready to start!
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-lg text-muted-foreground">Waiting for host to start...</p>
        )}

        <div className="border-2 border-border rounded-lg p-4 bg-card">
          <h2 className="text-xl font-bold mb-3 text-card-foreground">
            Players ({players.length}/12)
          </h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {players.map((player) => (
              <div
                key={player.id}
                className="p-3 border border-border rounded bg-muted text-base text-muted-foreground flex justify-between items-center gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="sm" />
                  <span className="truncate">{player.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {currentPlayerId === player.id && !isHost && onAvatarUpdated && (
                    <AvatarCreator
                      playerId={player.id}
                      roomId={roomId}
                      onAvatarSaved={(url) => onAvatarUpdated(player.id, url)}
                    />
                  )}
                  {isHost && onRemovePlayer && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemovePlayer(player.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

